import { OfflineContextService } from './offline-context.service';

describe('OfflineContextService', () => {
  it('usa o catalogo local quando o backend voltou mas o token expirou', () => {
    const auth = { isLoggedIn: () => false, isOfflineEnabled: () => true } as any;
    const service = new OfflineContextService({ getHost: () => 'http://backend' } as any, auth);
    const expiresAt = Date.now() + 60 * 60 * 1000;
    (service as any).stateSubject.next({
      offlineEnabled: true,
      backendOnline: true,
      checkingConnection: false,
      remainingMs: expiresAt - Date.now(),
      catalogExpired: false,
      catalog: { ownerKey: 'owner', snapshotId: 'snapshot', expiresAt },
      session: { ownerKey: 'owner', explicitlyLoggedOut: false },
    });

    expect(service.onlineSalesAvailable).toBeFalse();
    expect(service.shouldUseOfflineData).toBeTrue();
    expect(service.canEnterOfflineRoutes).toBeTrue();
  });

  it('ignora o catalogo local quando o backend desabilitou o recurso', () => {
    const auth = { isLoggedIn: () => false, isOfflineEnabled: () => false } as any;
    const service = new OfflineContextService({ getHost: () => 'http://backend' } as any, auth);
    const expiresAt = Date.now() + 60 * 60 * 1000;
    (service as any).stateSubject.next({
      offlineEnabled: false,
      backendOnline: false,
      checkingConnection: false,
      remainingMs: expiresAt - Date.now(),
      catalogExpired: false,
      catalog: { ownerKey: 'owner', snapshotId: 'snapshot', expiresAt },
      session: { ownerKey: 'owner', explicitlyLoggedOut: false },
    });

    expect(service.hasValidCatalog).toBeFalse();
    expect(service.shouldUseOfflineData).toBeFalse();
    expect(service.canEnterOfflineRoutes).toBeFalse();
  });
});
