import { PedidoVenda } from '../../sap/model/document/pedido-venda.model';

export type OfflineCatalogJobState = 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED';

export interface OfflineCatalogJob {
  id: string;
  userKey: string;
  state: OfflineCatalogJobState;
  progress: number;
  queuePosition?: number;
  currentDataset?: string;
  snapshotId?: string;
  error?: string;
}

export interface OfflineCatalogPart {
  id: string;
  dataset: string;
  index: number;
  size: number;
  sha256: string;
}

export interface OfflineCatalogManifest {
  snapshotId: string;
  userKey: string;
  schemaVersion: number;
  generatedAt: string;
  expiresAt: string;
  userId: string;
  userName: string;
  parts: OfflineCatalogPart[];
}

export interface OfflineCatalogMeta {
  ownerKey: string;
  snapshotId: string;
  schemaVersion: number;
  generatedAt: number;
  expiresAt: number;
  userId: string;
  userName: string;
}

export interface OfflineCatalogRecord {
  id: string;
  ownerKey: string;
  dataset: string;
  key: string;
  searchText: string;
  value: any;
}

export interface OfflineSessionRecord {
  id: 'active';
  ownerKey: string;
  host: string;
  userId: string;
  userName: string;
  roles: string[];
  expiresAt: number;
  explicitlyLoggedOut: boolean;
}

export type OfflineQueueStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'ERROR'
  | 'TRANSMITTED'
  | 'PENDING_AUTHORIZATION'
  | 'REJECTED';

export interface OfflineQueueRecord {
  localId: string;
  ownerKey: string;
  transmissionId: string;
  catalogId: string;
  createdAt: number;
  updatedAt: number;
  transmittedAt?: number;
  status: OfflineQueueStatus;
  quotation: PedidoVenda;
  customerName: string;
  total: number;
  attempts: number;
  lastError?: string;
  traceId?: string;
  authorizationId?: number;
  docEntry?: number;
  docNum?: string;
}

export interface OfflineQuotationSyncResponse {
  transmissionId: string;
  localId?: string;
  status: 'CREATED' | 'PENDING_AUTHORIZATION' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'NOT_FOUND';
  docEntry?: number;
  docNum?: string;
  authorizationId?: number;
  reason?: string;
}

export interface OfflineRuntimeState {
  offlineEnabled: boolean;
  backendOnline: boolean;
  checkingConnection: boolean;
  catalog?: OfflineCatalogMeta;
  session?: OfflineSessionRecord;
  remainingMs: number;
  catalogExpired: boolean;
}
