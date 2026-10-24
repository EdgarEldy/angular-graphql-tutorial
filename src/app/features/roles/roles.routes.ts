import { Routes } from '@angular/router';

/**
 * Routes for the roles and permissions administration section.
 *
 * Protected by adminGuard in app.routes.ts (the guard is applied at the parent
 * route level). Individual routes here do not need to re-apply the guard.
 *
 * Roles and permissions are separate pages because they have distinct CRUD
 * workflows: roles have a name and are assigned to users, while permissions are
 * resource:action pairs assigned to roles. Keeping them on separate routes
 * (rather than tabs inside a single component) lets them each be deep-linked
 * and bookmarked independently.
 */
export const rolesRoutes: Routes = [
  {
    path: '',
    // Lazy-load the role-list page as a separate bundle
    loadComponent: () =>
      import('./pages/role-list/role-list.page').then((m) => m.RoleListPage),
  },
  {
    path: 'permissions',
    // Lazy-load the permission-list page as a separate bundle
    loadComponent: () =>
      import('./pages/permission-list/permission-list.page').then((m) => m.PermissionListPage),
  },
];
