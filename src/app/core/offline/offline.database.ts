import Dexie, { Table } from 'dexie';
import {
  OfflineCatalogMeta,
  OfflineCatalogRecord,
  OfflineQueueRecord,
  OfflineSessionRecord,
} from './offline.models';

export class OfflineDatabase extends Dexie {
  catalogMeta!: Table<OfflineCatalogMeta, string>;
  catalogRecords!: Table<OfflineCatalogRecord, string>;
  queue!: Table<OfflineQueueRecord, string>;
  sessions!: Table<OfflineSessionRecord, string>;

  constructor() {
    super('pix-portal-offline');
    this.version(1).stores({
      catalogMeta: '&ownerKey, expiresAt',
      catalogRecords: '&id, ownerKey, dataset, [ownerKey+dataset], searchText',
      queue: '&localId, ownerKey, status, createdAt, [ownerKey+status]',
      sessions: '&id, ownerKey, expiresAt',
    });
  }
}

export const offlineDb = new OfflineDatabase();
