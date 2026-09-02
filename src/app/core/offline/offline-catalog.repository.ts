import { Injectable } from '@angular/core';
import { offlineDb } from './offline.database';
import { OfflineContextService } from './offline-context.service';

@Injectable({ providedIn: 'root' })
export class OfflineCatalogRepository {
  constructor(private context: OfflineContextService) {}

  async all(dataset: string): Promise<any[]> {
    const ownerKey = this.context.currentOwnerKey();
    if (!ownerKey) return [];
    return (await offlineDb.catalogRecords
      .where('[ownerKey+dataset]')
      .equals([ownerKey, dataset])
      .toArray())
      .map(record => record.value);
  }

  async get(dataset: string, key: string): Promise<any | undefined> {
    const ownerKey = this.context.currentOwnerKey();
    if (!ownerKey) return undefined;
    return (await offlineDb.catalogRecords.get(`${ownerKey}::${dataset}::${key}`))?.value;
  }

  async search(dataset: string, keyword: string, predicate?: (value: any) => boolean): Promise<any[]> {
    const normalized = (keyword || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\*/g, '')
      .toUpperCase();
    const records = await this.all(dataset);
    return records.filter(value => {
      const matches = JSON.stringify(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .includes(normalized);
      return matches && (!predicate || predicate(value));
    });
  }
}
