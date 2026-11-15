import { Routes } from '@angular/router';

/**
 * Routes for the categories feature.
 *
 * Protected by authGuard at the parent level in app.routes.ts.
 * CRUD actions (create, update, delete) are guarded by adminGuard at the UI level
 * (button visibility) and enforced by the backend for every mutation.
 */
export const categoriesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/category-list/category-list.page').then((m) => m.CategoryListPage),
  },
];
