import { Routes } from '@angular/router';
import { Shell } from './core/layout/shell/shell';
import { NotFound } from './core/layout/not-found/not-found';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
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
        loadChildren: () =>
          import('./features/users/users.routes').then((m) => m.usersRoutes),
      },
      {
        path: 'roles',
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
