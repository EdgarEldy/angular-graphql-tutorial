import { Routes } from '@angular/router';

/**
 * Routes for the users administration section.
 *
 * Protected by adminGuard in app.routes.ts (the guard is applied at the parent
 * route level). Individual routes here do not need to re-apply the guard.
 *
 * Currently only a list page is needed; a detail page is not required because
 * edit operations are handled through a dialog opened from the list row.
 */
export const usersRoutes: Routes = [
  {
    path: '',
    // Lazy-load the user-list page as a separate bundle
    loadComponent: () =>
      import('./pages/user-list/user-list.page').then((m) => m.UserListPage),
  },
];
