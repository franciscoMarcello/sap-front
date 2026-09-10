import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../shared/service/auth.service';

/**
 * Rota restrita por papel. Le os "role:X" do `data` da rota (que aqui e um array)
 * e libera se o usuario for `admin` (superusuario) ou tiver QUALQUER um dos papeis
 * exigidos. Sem "role:" no data -> libera (opt-in). E conveniencia de navegacao;
 * o backend tambem exige o papel (rules.yml + RoleBasedAuthorizationFilter).
 *
 * Usar junto do authGuard: `canActivate: [authGuard, roleGuard]` (authGuard garante
 * login/estado; roleGuard checa papel). Espelha o adminGuard, mas parametrizado
 * pelos papeis declarados na rota.
 */
export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // O data das rotas aqui e um array (["icon:...","role:..."]) - fora do padrao do Angular.
  // No snapshot o data pode vir mesclado/spreadado (array virando objeto {0:..,1:..}), o que
  // quebraria .map. Por isso lemos do routeConfig.data (array bruto) e caimos pra Object.values
  // como fallback, cobrindo os dois formatos.
  const raw: unknown = route.routeConfig?.data ?? route.data ?? [];
  const entries: any[] = Array.isArray(raw) ? raw : Object.values(raw as object);
  const exigidas = entries
    .map(it => (it?.toString() ?? ''))
    .filter(it => it.startsWith('role:'))
    .map(it => it.substring('role:'.length));

  if (exigidas.length === 0) {
    return true;
  }
  if (authService.hasRole('admin')) {
    return true;
  }
  if (exigidas.some(r => authService.hasRole(r))) {
    return true;
  }
  return router.navigate(['/home']);
};
