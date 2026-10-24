import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Restricts route activation to users with the `ADMIN` role.
 *
 * This guard is always applied alongside `authGuard`, which runs first and
 * redirects unauthenticated users to `/login`. By the time this guard runs,
 * `AuthService.currentUser` is non-null and `isAdmin` can be read directly.
 *
 * A non-admin user is redirected to the root path. The backend will also
 * return `FORBIDDEN` for any admin mutation they manage to invoke, which the
 * error link surfaces as a snackbar notification.
 *
 * @returns `true` to activate, or a `UrlTree` redirecting to `/`.
 */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }

  return router.createUrlTree(['/']);
};
