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
        path: '',
        redirectTo: 'categories',
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
  {
    path: 'login',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: '**',
    component: NotFound,
  },
];
