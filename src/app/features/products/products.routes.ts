import { Routes } from '@angular/router';

/**
 * Routes for the products feature.
 *
 * Protected by authGuard at the parent level in app.routes.ts.
 * CRUD actions (create, update, delete) are guarded by adminGuard at the UI level
 * (button visibility) and enforced by the backend for every mutation.
 */
export const productsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/product-list/product-list.page').then((m) => m.ProductListPage),
  },
];
