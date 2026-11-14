import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Functional route guard that requires an authenticated session.
 *
 * Reads `AuthService.isAuthenticated` synchronously. The APP_INITIALIZER
 * restores the session before the router processes the first navigation, so
 * the signal is already settled when any guard runs. No observable or promise
 * is needed, which keeps navigation snappy.
 *
 * When the user is not authenticated, the guard redirects to /auth/login and
 * passes the attempted URL as a returnUrl query parameter. After a successful
 * login the LoginPage reads that parameter and navigates back to the original
 * page, giving the user a seamless experience.
 *
 * @param _route - Unused; present to satisfy `CanActivateFn`.
 * @param state - Router state snapshot; provides `state.url` for the return URL.
 * @returns `true` to activate, or a `UrlTree` redirecting to `/auth/login`.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Preserve the attempted URL so login can redirect back after success
  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};
