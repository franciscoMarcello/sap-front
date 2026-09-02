import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../shared/service/auth.service';

/**
 * Rota so para admin. O backend tambem exige o papel (rules.yml + checagem no controller) - isso
 * aqui e conveniencia de navegacao, nao a trava de seguranca.
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn() && authService.hasRole('admin')) {
    return true;
  }
  return router.navigate(['/home']);
};
