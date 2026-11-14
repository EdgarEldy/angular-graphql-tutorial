import { Routes } from '@angular/router';

/**
 * Public authentication routes loaded lazily under the /auth prefix in app.routes.ts.
 *
 * All routes in this group render outside the Shell so the user sees a clean
 * auth layout without the toolbar or sidenav. URL paths match the backend email
 * link convention (/auth/activate-account?token=... and /auth/reset-password?token=...)
 * so activation and reset links work without any server-side redirect.
 *
 * Route structure:
 * - /auth/login             -> LoginPagePage
 * - /auth/register          -> RegisterPagePage
 * - /auth/activate-account  -> ActivatePagePage   (reads ?token= from query string)
 * - /auth/forgot-password   -> ForgotPasswordPagePage
 * - /auth/reset-password    -> ResetPasswordPagePage (reads ?token= from query string)
 */
export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login-page/login-page.page').then((m) => m.LoginPagePage),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register-page/register-page.page').then((m) => m.RegisterPagePage),
  },
  {
    path: 'activate-account',
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
