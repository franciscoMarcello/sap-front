import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../shared/service/auth.service';

import { inject } from '@angular/core';
import { OfflineContextService } from './offline/offline-context.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const offline = inject(OfflineContextService);

  if (state.url.startsWith('/venda/offline') && !offline.offlineEnabled) {
    return router.createUrlTree(['/home']);
  }
  if (offline.onlineSalesAvailable) {
    return true;
  }
  const offlineRoute = state.url.startsWith('/venda/document') || state.url.startsWith('/venda/offline');
  if (offlineRoute && offline.canEnterOfflineRoutes) {
    return true;
  } else {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

  }
};
