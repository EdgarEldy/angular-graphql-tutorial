import { inject, Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import type { FetchResult, Observable } from '@apollo/client/core';
import type { QueryRef } from 'apollo-angular';
import {
  CreateOrderDocument,
  type CreateOrderMutation,
  type CreateOrderMutationVariables,
  GetCustomerOptionsDocument,
  type GetCustomerOptionsQuery,
  type GetCustomerOptionsQueryVariables,
  GetOrderDocument,
  GetOrdersDocument,
  type GetOrderQuery,
  type GetOrderQueryVariables,
  type GetOrdersQuery,
  type GetOrdersQueryVariables,
  GetProductOptionsDocument,
  type GetProductOptionsQuery,
  type GetProductOptionsQueryVariables,
  OrderCreatedDocument,
  type OrderCreatedSubscription,
  type OrderCreatedSubscriptionVariables,
} from '../../../core/graphql/generated/graphql';

/**
 * Feature service for the Orders section.
 *
 * Wraps Apollo queries, mutations, and the real-time orderCreated subscription.
 * No UI logic lives here: no snackbars, no navigation, no dialog interactions.
 * All Apollo calls use errorPolicy:'all' so callers can inspect both data and
 * errors, enabling inline error display in dialogs without closing them on
 * BAD_REQUEST.
 *
 * CreateOrder returns the saved Order including the full OrderFields fragment
 * (customer + product + category). Apollo's InMemoryCache normalises this under
 * Order:<id>; the paginated list query does not auto-update because Apollo does
 * not know where to insert the new order in a sorted/paged result -- the caller
 * must refetch or prepend the new order manually.
 */
@Injectable({
  providedIn: 'root',
})
export class Orders {
  // inject() replaces constructor injection in Angular 21
  private readonly apollo = inject(Apollo);

  /**
   * Creates a watchQuery for the paginated order list.
   *
   * Returns a QueryRef rather than an Observable so the caller can call
   * .refetch() after create operations and when the customer filter changes.
   * watchQuery keeps the subscription alive and reacts to InMemoryCache updates.
   *
   * @param customerId - Customer ID to filter by, or null for all orders.
   * @param page - 0-based page index.
   * @param size - Number of orders per page.
   * @returns Apollo QueryRef for the paginated order list.
   */
  watchOrders(
    customerId: string | null,
    page: number,
    size: number,
  ): QueryRef<GetOrdersQuery, GetOrdersQueryVariables> {
    return this.apollo.watchQuery<GetOrdersQuery, GetOrdersQueryVariables>({
      query: GetOrdersDocument,
      variables: { customerId, page, size },
      errorPolicy: 'all',
    });
  }

  /**
   * Creates a watchQuery for a single order by ID.
   *
   * Used by the order detail page. Returns a QueryRef so the caller can call
   * .refetch() to force a fresh fetch after an optimistic update or on retry.
   *
   * @param id - The order ID to fetch.
   * @returns Apollo QueryRef for the single order query.
   */
  watchOrder(id: string): QueryRef<GetOrderQuery, GetOrderQueryVariables> {
    return this.apollo.watchQuery<GetOrderQuery, GetOrderQueryVariables>({
      query: GetOrderDocument,
      variables: { id },
      errorPolicy: 'all',
    });
  }

  /**
   * Creates a watchQuery for the flat customer list used in select dropdowns.
   *
   * Fetches up to 1000 customers (page 0, size 1000). This ceiling is
   * acceptable for a customer select because the total count is bounded in
   * practice and avoids implementing a server-side autocomplete for the tutorial.
   * The QueryRef allows the caller to react to live cache updates if a new
   * customer is created while the form is open.
   *
   * @returns Apollo QueryRef for the full customer list (select options).
   */
  watchCustomerOptions(): QueryRef<GetCustomerOptionsQuery, GetCustomerOptionsQueryVariables> {
    return this.apollo.watchQuery<GetCustomerOptionsQuery, GetCustomerOptionsQueryVariables>({
      query: GetCustomerOptionsDocument,
      errorPolicy: 'all',
    });
  }

  /**
   * Creates a watchQuery for the flat product list used in the order form dialog.
   *
   * Fetches up to 1000 products without a category filter. The unitPrice on each
   * product is used by the dialog to compute the estimated total before the order
   * is sent to the backend.
   *
   * @returns Apollo QueryRef for the full product list (select options with price).
   */
  watchProductOptions(): QueryRef<GetProductOptionsQuery, GetProductOptionsQueryVariables> {
    return this.apollo.watchQuery<GetProductOptionsQuery, GetProductOptionsQueryVariables>({
      query: GetProductOptionsDocument,
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the createOrder mutation.
   *
   * The returned Order (including nested Customer and Product) is normalised into
   * the InMemoryCache under Order:<id>. The paginated list query is not updated
   * automatically because Apollo does not know where to insert the new order in a
   * paged result; the caller must either call refetch() or manually prepend the
   * returned order to the local list signal.
   *
   * @param input - The order creation input (customerId, productId, quantity).
   * @returns Observable of the raw mutation result.
   */
  createOrder(
    input: CreateOrderMutationVariables['input'],
  ): Observable<Apollo.MutateResult<CreateOrderMutation>> {
    return this.apollo.mutate<CreateOrderMutation, CreateOrderMutationVariables>({
      mutation: CreateOrderDocument,
      variables: { input },
      errorPolicy: 'all',
    });
  }

  /**
   * Opens a WebSocket subscription to the orderCreated event.
   *
   * Uses apollo.subscribe() (not watchQuery) because subscriptions are
   * push-based: the server initiates each message over the graphql-ws
   * WebSocket connection configured in apollo.config.ts. The split() link
   * in the Apollo config routes subscription operations to WsLink and all
   * other operations to HttpLink.
   *
   * The caller is responsible for cleanup (takeUntilDestroyed) to prevent
   * memory leaks; the subscription is not automatically closed when the
   * service is destroyed because the service is providedIn:'root' and lives
   * for the entire application lifetime.
   *
   * @returns Observable that emits a FetchResult on each orderCreated event.
   */
  subscribeToOrderCreated(): Observable<FetchResult<OrderCreatedSubscription>> {
    // apollo.subscribe() routes to the WebSocket link via the split() in apollo.config.ts
    return this.apollo.subscribe<OrderCreatedSubscription, OrderCreatedSubscriptionVariables>({
      query: OrderCreatedDocument,
      errorPolicy: 'all',
    });
  }
}
