import { Routes } from '@angular/router';
import { Shell } from './core/layout/shell/shell';
import { NotFound } from './features/not-found/not-found';
import { NotAllowed } from './features/not-allowed/not-allowed';
import { authGuard } from './core/auth/auth.guard';

/**
 * Application route configuration.
 *
 * All authenticated feature routes are children of Shell so they share the
 * toolbar + sidenav layout via its router-outlet.
 *
 * Auth routes (login, register, activate, forgot/reset password) are mounted
 * at /auth, outside the shell, so they render without the nav bar.
 *
 * Public features (categories, products) use a shell group without any guard
 * so unauthenticated visitors can read them. Angular's router tries route
 * groups in order and backtracks when no children match, so the public shell
 * handles /categories and the authenticated shell handles everything else.
 *
 * Lazy loading with loadChildren() / loadComponent() demonstrates code-splitting:
 * each feature module is downloaded only when the user first navigates to it.
 */
export const routes: Routes = [
  // Error pages (outside shell so they render without the nav)
  { path: 'not-allowed', component: NotAllowed },
  { path: '404', component: NotFound },

  // Redirect the bare root to the default authenticated page.
  // Angular resolves this first (pathMatch: 'full' means exact '/' only),
  // then the shell's authGuard decides: authenticated users land on
  // /dashboard, unauthenticated users are redirected to /auth/login.
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Auth pages under /auth/** (outside shell -- no toolbar/sidenav)
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },

  // Public shell: categories and products are readable by any visitor.
  // The shell still renders the nav bar so the user can navigate to other areas.
  {
    path: '',
    component: Shell,
    children: [
      {
        path: 'categories',
        loadChildren: () =>
          import('./features/categories/categories.routes').then(
            (m) => m.categoriesRoutes,
          ),
      },
      {
        path: 'products',
        loadChildren: () =>
          import('./features/products/products.routes').then(
            (m) => m.productsRoutes,
          ),
      },
    ],
  },

  // Authenticated shell: everything behind authGuard
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      // Default redirect
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // Dashboard
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard/dashboard.page').then(
            (m) => m.DashboardPage,
          ),
      },

      // Customers -- behind authGuard
      {
        path: 'customers',
        loadChildren: () =>
          import('./features/customers/customers.routes').then(
            (m) => m.customersRoutes,
          ),
      },

      // Orders -- behind authGuard
      {
        path: 'orders',
        loadChildren: () =>
          import('./features/orders/orders.routes').then(
            (m) => m.ordersRoutes,
          ),
      },

      // Administration area: /users, /roles and /permissions require the ADMIN role.
      // A pathless parent groups the admin routes without adding a URL segment.
      // roleGuard is added here on this branch to enforce RBAC at the route level.
      {
        path: '',
        children: [
          {
            path: 'users',
            loadChildren: () =>
              import('./features/users/users.routes').then(
                (m) => m.usersRoutes,
              ),
          },
          {
            path: 'roles',
            loadChildren: () =>
              import('./features/roles/roles.routes').then(
                (m) => m.rolesRoutes,
              ),
          },
        ],
      },
    ],
  },

  // Wildcard -- must be last
  { path: '**', component: NotFound },
];
