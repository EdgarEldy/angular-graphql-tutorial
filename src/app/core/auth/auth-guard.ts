import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Prevents unauthenticated users from activating a route.
 *
 * The guard reads `AuthService.isAuthenticated` synchronously, which is valid
 * because `APP_INITIALIZER` restores the session before the router processes
 * the first navigation. There is no async round-trip here; if the signal is
 * false the token was absent or already cleared by the error link.
 *
 * A rejected navigation captures the attempted URL in `returnUrl` so the login
 * page can redirect back to it after a successful sign-in.
 *
 * @param _route - Unused; present to satisfy `CanActivateFn`.
 * @param state - Router state snapshot; provides `state.url` for the return URL.
 * @returns `true` to activate, or a `UrlTree` redirecting to `/login`.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
