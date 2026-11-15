import { Routes } from '@angular/router';

/**
 * Routes for the customers feature.
 *
 * Protected by authGuard at the parent level in app.routes.ts.
 * CRUD actions (create, update, delete) are open to all authenticated users;
 * the backend enforces its own authorization on every mutation.
 */
export const customersRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/customer-list/customer-list.page').then((m) => m.CustomerListPage),
  },
];
