import { inject, Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable } from 'rxjs';
import type { QueryRef } from 'apollo-angular';
import {
  CreateCustomerDocument,
  type CreateCustomerMutation,
  type CreateCustomerMutationVariables,
  DeleteCustomerDocument,
  type DeleteCustomerMutation,
  type DeleteCustomerMutationVariables,
  GetCustomersDocument,
  type GetCustomersQuery,
  type GetCustomersQueryVariables,
  UpdateCustomerDocument,
  type UpdateCustomerMutation,
  type UpdateCustomerMutationVariables,
} from '../../../core/graphql/generated/graphql';

/**
 * Feature service for the Customers section.
 *
 * Wraps Apollo queries and mutations for customer management. No UI logic
 * lives here: no snackbars, no navigation, no dialog interactions. All Apollo
 * calls use errorPolicy:'all' so callers can inspect both data and errors,
 * enabling inline error display in dialogs without closing them on BAD_REQUEST
 * (e.g. when the backend rejects a deletion because the customer has orders).
 *
 * CreateCustomer and UpdateCustomer return the saved Customer entity, which
 * Apollo's InMemoryCache normalises under Customer:<id>. The list query
 * therefore reflects the change without a refetch when a customer is updated.
 *
 * DeleteCustomer returns Boolean, so the cache cannot auto-update. The update
 * callback uses cache.evict() to remove the Customer entity immediately so the
 * list watchQuery drops the row without a network round-trip.
 */
@Injectable({
  providedIn: 'root',
})
export class Customers {
  // inject() replaces constructor injection in Angular 21
  private readonly apollo = inject(Apollo);

  /**
   * Creates a watchQuery for the paginated customer list.
   *
   * Returns a QueryRef rather than an Observable so the caller can call
   * .refetch() after delete operations and after dialog closes. watchQuery
   * keeps the subscription alive and reacts to InMemoryCache updates triggered
   * by create/update mutations (which return the Customer entity).
   *
   * @param page - 0-based page index.
   * @param size - Number of customers per page.
   * @returns Apollo QueryRef for the paginated customer list.
   */
  watchCustomers(
    page: number,
    size: number,
  ): QueryRef<GetCustomersQuery, GetCustomersQueryVariables> {
    return this.apollo.watchQuery<GetCustomersQuery, GetCustomersQueryVariables>({
      query: GetCustomersDocument,
      variables: { page, size },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the createCustomer mutation.
   *
   * The returned Customer is normalised into the InMemoryCache. The paginated
   * list query is not automatically updated because Apollo does not know where
   * to insert the new customer in a sorted/paged result. The caller must call
   * refetch() after success.
   *
   * @param input - The customer creation input (firstName, lastName, telephone, email, address).
   * @returns Observable of the raw mutation result.
   */
  createCustomer(
    input: CreateCustomerMutationVariables['input'],
  ): Observable<Apollo.MutateResult<CreateCustomerMutation>> {
    return this.apollo.mutate<CreateCustomerMutation, CreateCustomerMutationVariables>({
      mutation: CreateCustomerDocument,
      variables: { input },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the updateCustomer mutation.
   *
   * The returned Customer is written into the cache by its __typename + id key,
   * updating every query that references this customer without a manual refetch.
   * This is why the list page does not need to refetch after a successful edit.
   *
   * @param id - ID of the customer to update.
   * @param input - Updated field values (firstName, lastName, telephone, email, address).
   * @returns Observable of the raw mutation result.
   */
  updateCustomer(
    id: UpdateCustomerMutationVariables['id'],
    input: UpdateCustomerMutationVariables['input'],
  ): Observable<Apollo.MutateResult<UpdateCustomerMutation>> {
    return this.apollo.mutate<UpdateCustomerMutation, UpdateCustomerMutationVariables>({
      mutation: UpdateCustomerDocument,
      variables: { id, input },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the deleteCustomer mutation and evicts the entity from the cache.
   *
   * The mutation returns Boolean, so Apollo cannot auto-update the cache.
   * The update callback uses cache.evict() to remove the normalised Customer
   * entry synchronously, so the list watchQuery drops the row without a
   * network round-trip. cache.gc() then collects any dangling references.
   *
   * Note: the backend may reject the deletion with BAD_REQUEST when the
   * customer still has orders. In that case the caller receives result.error
   * and must surface the backend message without evicting the entity.
   * The update callback only runs on a successful network response, so no
   * special guard is needed here.
   *
   * @param id - ID of the customer to delete.
   * @returns Observable of the raw mutation result.
   */
  deleteCustomer(
    id: DeleteCustomerMutationVariables['id'],
  ): Observable<Apollo.MutateResult<DeleteCustomerMutation>> {
    return this.apollo.mutate<DeleteCustomerMutation, DeleteCustomerMutationVariables>({
      mutation: DeleteCustomerDocument,
      variables: { id },
      errorPolicy: 'all',
      // evict() removes Customer:<id> from the normalized cache so the list
      // watchQuery updates immediately without a refetch round-trip.
      update: (cache) => {
        cache.evict({ id: cache.identify({ __typename: 'Customer', id }) });
        cache.gc();
      },
    });
  }
}
