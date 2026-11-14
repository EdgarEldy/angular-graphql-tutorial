import { Routes } from '@angular/router';
import { Shell } from './core/layout/shell/shell';
import { NotFound } from './core/layout/not-found/not-found';
import { authGuard } from './core/auth/auth-guard';
import { adminGuard } from './core/auth/admin-guard';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    // authGuard protects all shell children; individual admin routes also apply adminGuard.
    canActivate: [authGuard],
    children: [
      {
        // Default route renders the home page instead of redirecting to a feature,
        // so the toolbar home link (/) always lands on a stable, intentional view.
        path: '',
        loadComponent: () =>
          import('./features/home/pages/home/home.page').then((m) => m.HomePage),
        pathMatch: 'full',
      },
      {
        path: 'categories',
        loadChildren: () =>
          import('./features/categories/categories.routes').then((m) => m.categoriesRoutes),
      },
      {
        path: 'products',
        loadChildren: () =>
          import('./features/products/products.routes').then((m) => m.productsRoutes),
      },
      {
        path: 'customers',
        loadChildren: () =>
          import('./features/customers/customers.routes').then((m) => m.customersRoutes),
      },
      {
        path: 'orders',
        loadChildren: () =>
          import('./features/orders/orders.routes').then((m) => m.ordersRoutes),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadChildren: () =>
          import('./features/users/users.routes').then((m) => m.usersRoutes),
      },
      {
        path: 'roles',
        canActivate: [adminGuard],
        loadChildren: () =>
          import('./features/roles/roles.routes').then((m) => m.rolesRoutes),
      },
    ],
  },
  // Auth pages are top-level routes so they are reachable without the Shell wrapper.
  // /login and /register are navigated to programmatically by guards and links.
  // /auth/activate-account and /auth/reset-password must match the URLs the
  // backend embeds in activation and password-reset emails; changing them would
  // break every link already sent to users.
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login-page/login-page.page').then((m) => m.LoginPagePage),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/pages/register-page/register-page.page').then(
        (m) => m.RegisterPagePage,
      ),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/pages/forgot-password-page/forgot-password-page.page').then(
        (m) => m.ForgotPasswordPagePage,
      ),
  },
  {
    // Nested under /auth to match the email link paths built by the backend:
    //   /auth/activate-account?token=...
    //   /auth/reset-password?token=...
    path: 'auth',
    children: [
      {
        path: 'activate-account',
        loadComponent: () =>
          import('./features/auth/pages/activate-page/activate-page.page').then(
            (m) => m.ActivatePagePage,
          ),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./features/auth/pages/reset-password-page/reset-password-page.page').then(
            (m) => m.ResetPasswordPagePage,
          ),
      },
    ],
  },
  {
    path: '**',
    component: NotFound,
  },
];
