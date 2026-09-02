import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ConfigService } from '../services/config.service';
import { AuthService } from '../../shared/service/auth.service';
import { offlineDb } from './offline.database';
import { OfflineCatalogMeta, OfflineRuntimeState, OfflineSessionRecord } from './offline.models';
import { AuthConfig, initKeycloak } from '../keycloak';

@Injectable({ providedIn: 'root' })
export class OfflineContextService {
  private initialized = false;
  private readonly stateSubject = new BehaviorSubject<OfflineRuntimeState>({
    offlineEnabled: false,
    backendOnline: navigator.onLine,
    checkingConnection: true,
    remainingMs: 0,
    catalogExpired: true,
  });

  readonly state$ = this.stateSubject.asObservable();

  constructor(private config: ConfigService, private auth: AuthService) {
    this.patch({ offlineEnabled: this.auth.isOfflineEnabled() });
  }

  async initialize(): Promise<void> {
    if(this.initialized) return;
    this.initialized = true;
    const session = await offlineDb.sessions.get('active');
    const catalog = session ? await offlineDb.catalogMeta.get(session.ownerKey) : undefined;
    this.patch({ session, catalog });
    await this.checkBackend();
    window.addEventListener('online', () => this.checkBackend());
    window.addEventListener('offline', () => this.patch({ backendOnline: false, checkingConnection: false }));
    window.setInterval(() => this.tick(), 1000);
    window.setInterval(() => this.checkBackend(), 15000);
  }

  get snapshot(): OfflineRuntimeState {
    return this.stateSubject.value;
  }

  get backendOnline(): boolean {
    return this.snapshot.backendOnline;
  }

  get offlineEnabled(): boolean {
    return this.snapshot.offlineEnabled;
  }

  get onlineSalesAvailable(): boolean {
    return this.backendOnline && this.auth.isLoggedIn();
  }

  get hasValidCatalog(): boolean {
    return this.offlineEnabled && !!this.snapshot.catalog && !this.snapshot.catalogExpired;
  }

  get shouldUseOfflineData(): boolean {
    return !this.onlineSalesAvailable && this.hasValidCatalog;
  }

  get canEnterOfflineRoutes(): boolean {
    return !!this.snapshot.session && !this.snapshot.session.explicitlyLoggedOut && this.hasValidCatalog;
  }

  currentOwnerKey(): string | null {
    try {
      const userId = this.auth.getOfflineUserId();
      return `${this.config.getHost()}::${userId}`;
    } catch {
      return this.snapshot.session?.ownerKey ?? null;
    }
  }

  async activateCatalog(meta: OfflineCatalogMeta, profile: any): Promise<void> {
    const session: OfflineSessionRecord = {
      id: 'active',
      ownerKey: meta.ownerKey,
      host: this.config.getHost(),
      userId: meta.userId,
      userName: meta.userName,
      roles: profile?.roles ?? this.auth.getRoles(),
      expiresAt: meta.expiresAt,
      explicitlyLoggedOut: false,
    };
    await offlineDb.sessions.put(session);
    this.patch({ catalog: meta, session });
  }

  async explicitLogout(): Promise<void> {
    const session = this.snapshot.session;
    if (!session) return;
    const updated = { ...session, explicitlyLoggedOut: true };
    await offlineDb.sessions.put(updated);
    this.patch({ session: updated });
  }

  async restoreOnlineSession(): Promise<void> {
    const session = this.snapshot.session;
    if (!session || !this.auth.isLoggedIn()) return;
    const updated = { ...session, explicitlyLoggedOut: false };
    await offlineDb.sessions.put(updated);
    this.patch({ session: updated });
  }

  async checkBackend(): Promise<boolean> {
    this.patch({ checkingConnection: true });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`${this.config.getHost()}/auth/config`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const online = response.ok;
      let offlineEnabled = this.offlineEnabled;
      if(online){
        const authConfig = await response.json() as AuthConfig;
        offlineEnabled = authConfig.offlineEnabled === true;
        (window as any)['auth-config'] = authConfig;
        localStorage.setItem('auth_config_cache', JSON.stringify(authConfig));
        if(authConfig.mode === 'keycloak' && authConfig.keycloak && !(window as any).keycloak)
          await initKeycloak(authConfig.keycloak);
      }
      this.patch({
        offlineEnabled,
        backendOnline: online,
        checkingConnection: false,
      });
      return online;
    } catch {
      this.patch({ backendOnline: false, checkingConnection: false });
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private tick(): void {
    const expiresAt = this.snapshot.catalog?.expiresAt ?? 0;
    const remainingMs = Math.max(0, expiresAt - Date.now());
    this.patch({ remainingMs, catalogExpired: remainingMs <= 0 });
  }

  private patch(partial: Partial<OfflineRuntimeState>): void {
    const next = { ...this.stateSubject.value, ...partial };
    const expiresAt = next.catalog?.expiresAt ?? 0;
    next.remainingMs = Math.max(0, expiresAt - Date.now());
    next.catalogExpired = next.remainingMs <= 0;
    this.stateSubject.next(next);
  }
}
