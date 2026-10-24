import { Routes } from '@angular/router';

/**
 * Public authentication routes (no authGuard applied here).
 *
 * These routes are loaded lazily under the `/login` parent path in app.routes.ts.
 * The public routes are kept separate from the shell so they render without the
 * toolbar and sidenav (unauthenticated users should see a clean auth layout).
 *
 * Route structure:
 * - /login         -> LoginPagePage
 * - /register      -> RegisterPagePage
 * - /activate      -> ActivatePagePage    (reads ?token= from query string)
 * - /forgot-password -> ForgotPasswordPagePage
 * - /reset-password  -> ResetPasswordPagePage (reads ?token= from query string)
 */
export const authRoutes: Routes = [
  {
    path: '',
    // Lazy-load the login page component directly -- each page is its own chunk
    loadComponent: () =>
      import('./pages/login-page/login-page.page').then((m) => m.LoginPagePage),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register-page/register-page.page').then((m) => m.RegisterPagePage),
  },
  {
    path: 'activate',
    loadComponent: () =>
      import('./pages/activate-page/activate-page.page').then((m) => m.ActivatePagePage),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password-page/forgot-password-page.page').then(
        (m) => m.ForgotPasswordPagePage,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password-page/reset-password-page.page').then(
        (m) => m.ResetPasswordPagePage,
      ),
  },
];
