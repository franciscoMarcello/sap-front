import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ConfigService } from '../services/config.service';
import { AuthService } from '../../shared/service/auth.service';
import { PedidoVenda } from '../../sap/model/document/pedido-venda.model';
import { offlineDb } from './offline.database';
import { OfflineContextService } from './offline-context.service';
import { OfflineQueueRecord, OfflineQuotationSyncResponse } from './offline.models';

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly url: string;
  private readonly queueSubject = new BehaviorSubject<OfflineQueueRecord[]>([]);
  private syncing = false;
  readonly queue$ = this.queueSubject.asObservable();

  constructor(
    config: ConfigService,
    private http: HttpClient,
    private context: OfflineContextService,
    private auth: AuthService
  ) {
    this.url = `${config.getHost()}/offline/quotations`;
  }

  async initialize(): Promise<void> {
    await this.cleanup();
    await this.refresh();
    this.context.state$.subscribe(state => {
      if (state.offlineEnabled && state.backendOnline && this.auth.isLoggedIn()) this.synchronize();
    });
  }

  async enqueue(quotations: PedidoVenda[], customerName: string, _total?: number): Promise<string[]> {
    const ownerKey = this.context.currentOwnerKey();
    const catalogId = this.context.snapshot.catalog?.snapshotId;
    if (!ownerKey || !catalogId || !this.context.hasValidCatalog) {
      throw new Error('Os dados offline estão vencidos ou indisponíveis');
    }
    const now = Date.now();
    const records = quotations.map(quotation => ({
      localId: this.uuid(),
      ownerKey,
      transmissionId: this.uuid(),
      catalogId,
      createdAt: now,
      updatedAt: now,
      status: 'PENDING' as const,
      quotation,
      customerName,
      total: this.quotationTotal(quotation),
      attempts: 0,
    }));
    await offlineDb.queue.bulkAdd(records);
    await this.refresh();
    return records.map(record => record.transmissionId);
  }

  async retry(localId: string): Promise<void> {
    await offlineDb.queue.update(localId, {
      status: 'PENDING',
      lastError: undefined,
      traceId: undefined,
      updatedAt: Date.now(),
    });
    await this.refresh();
    await this.synchronize();
  }

  get(localId: string): Promise<OfflineQueueRecord | undefined> {
    return offlineDb.queue.get(localId);
  }

  async edit(localId: string, quotation: PedidoVenda, customerName: string, _total?: number): Promise<void> {
    const current = await offlineDb.queue.get(localId);
    if (!current || !['PENDING', 'ERROR'].includes(current.status)) return;
    await offlineDb.queue.update(localId, {
      quotation,
      customerName,
      total: this.quotationTotal(quotation),
      status: 'PENDING',
      attempts: 0,
      lastError: undefined,
      traceId: undefined,
      updatedAt: Date.now(),
    });
    await this.refresh();
  }

  async remove(localId: string): Promise<void> {
    const current = await offlineDb.queue.get(localId);
    if (!current || !['PENDING', 'ERROR'].includes(current.status)) return;
    await offlineDb.queue.delete(localId);
    await this.refresh();
  }

  async synchronize(): Promise<void> {
    if (this.syncing || !this.context.offlineEnabled || !this.context.backendOnline || !this.auth.isLoggedIn()) return;
    const locks = (navigator as any).locks;
    if (locks?.request) {
      await locks.request('pix-portal-offline-sync', { ifAvailable: true }, async lock => {
        if (lock) await this.runSynchronization();
      });
      return;
    }
    await this.runSynchronization();
  }

  private async runSynchronization(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    try {
      const ownerKey = this.context.currentOwnerKey();
      if (!ownerKey) return;
      const pendingAuthorization = await offlineDb.queue
        .where('[ownerKey+status]')
        .equals([ownerKey, 'PENDING_AUTHORIZATION'])
        .toArray();
      for (const record of pendingAuthorization) await this.reconcile(record);

      while (this.context.offlineEnabled && this.context.backendOnline && this.auth.isLoggedIn()) {
        const record = await offlineDb.queue
          .where('[ownerKey+status]')
          .equals([ownerKey, 'PENDING'])
          .sortBy('createdAt')
          .then(items => items[0]);
        if (!record) break;
        const keepGoing = await this.transmit(record);
        if (!keepGoing) break;
      }
    } finally {
      this.syncing = false;
      await this.refresh();
    }
  }

  private async transmit(record: OfflineQueueRecord): Promise<boolean> {
    await offlineDb.queue.update(record.localId, {
      status: 'SYNCING',
      attempts: record.attempts + 1,
      updatedAt: Date.now(),
    });
    await this.refresh();
    try {
      const response = await firstValueFrom(this.http.post<OfflineQuotationSyncResponse>(`${this.url}/sync`, {
        transmissionId: record.transmissionId,
        localId: record.localId,
        catalogId: record.catalogId,
        createdOfflineAt: new Date(record.createdAt).toISOString(),
        quotation: record.quotation,
      }));
      await this.applyResponse(record, response);
      return response.status !== 'IN_PROGRESS';
    } catch (error: any) {
      const httpError = error as HttpErrorResponse;
      const connectivityFailure = httpError.status === 0 || httpError.status === 401;
      await offlineDb.queue.update(record.localId, {
        status: connectivityFailure ? 'PENDING' : 'ERROR',
        lastError: connectivityFailure ? undefined : this.errorMessage(httpError),
        traceId: httpError.error?.traceId,
        updatedAt: Date.now(),
      });
      if (httpError.status === 0) await this.context.checkBackend();
      return false;
    }
  }

  private async reconcile(record: OfflineQueueRecord): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<OfflineQuotationSyncResponse>(`${this.url}/${record.transmissionId}`)
      );
      if (response.status !== 'NOT_FOUND') await this.applyResponse(record, response);
    } catch {
      // Reconciliation is best effort and will be retried on the next connection cycle.
    }
  }

  private async applyResponse(record: OfflineQueueRecord, response: OfflineQuotationSyncResponse): Promise<void> {
    const status = response.status === 'PENDING_AUTHORIZATION'
      ? 'PENDING_AUTHORIZATION'
      : response.status === 'REJECTED'
        ? 'REJECTED'
        : response.status === 'IN_PROGRESS'
          ? 'PENDING'
          : 'TRANSMITTED';
    await offlineDb.queue.update(record.localId, {
      status,
      authorizationId: response.authorizationId,
      docEntry: response.docEntry,
      docNum: response.docNum,
      lastError: response.status === 'REJECTED' ? response.reason : undefined,
      transmittedAt: ['CREATED', 'APPROVED'].includes(response.status) ? Date.now() : record.transmittedAt,
      updatedAt: Date.now(),
    });
  }

  private async cleanup(): Promise<void> {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const old = await offlineDb.queue.where('status').equals('TRANSMITTED').toArray();
    await offlineDb.queue.bulkDelete(old.filter(item => (item.transmittedAt || item.updatedAt) < cutoff).map(item => item.localId));
  }

  private async refresh(): Promise<void> {
    const ownerKey = this.context.currentOwnerKey() || this.context.snapshot.session?.ownerKey;
    if (!ownerKey) {
      this.queueSubject.next([]);
      return;
    }
    const records = await offlineDb.queue.where('ownerKey').equals(ownerKey).sortBy('createdAt');
    this.queueSubject.next(records.reverse());
  }

  private errorMessage(error: HttpErrorResponse): string {
    if (typeof error.error === 'string') return error.error;
    return error.error?.mensagem || error.error?.message || error.message || 'Falha ao transmitir a cotação';
  }

  private uuid(): string {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  private quotationTotal(quotation: PedidoVenda): number {
    const products = (quotation.DocumentLines || []).reduce((total, line) => {
      const unitPrice = Number(line.U_preco_negociado ?? line.UnitPrice ?? 0);
      return total + Number(line.Quantity || 0) * unitPrice;
    }, 0);
    return products + Number(quotation.Frete || 0);
  }
}
