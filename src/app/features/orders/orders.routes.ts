import { Routes } from '@angular/router';

/**
 * Routes for the orders feature.
 *
 * Protected by authGuard at the parent level in app.routes.ts.
 * The list route is the default (empty path); the detail route uses the order
 * ID as a URL segment so it is bookmark-able and shareable. Both pages are
 * lazily loaded: Angular only downloads their chunk when the user navigates
 * to /orders for the first time.
 */
export const ordersRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/order-list/order-list.page').then((m) => m.OrderListPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/order-detail/order-detail.page').then((m) => m.OrderDetailPage),
  },
];
