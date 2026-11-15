import { inject, Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable } from 'rxjs';
import type { QueryRef } from 'apollo-angular';
import {
  CreateProductDocument,
  type CreateProductMutation,
  type CreateProductMutationVariables,
  DeleteProductDocument,
  type DeleteProductMutation,
  type DeleteProductMutationVariables,
  GetProductsDocument,
  type GetProductsQuery,
  type GetProductsQueryVariables,
  UpdateProductDocument,
  type UpdateProductMutation,
  type UpdateProductMutationVariables,
} from '../../../core/graphql/generated/graphql';

/**
 * Feature service for the Products section.
 *
 * Wraps Apollo queries and mutations for product management. No UI logic
 * lives here: no snackbars, no navigation, no dialog interactions. All Apollo
 * calls use errorPolicy:'all' so callers can inspect both data and errors,
 * enabling inline error display in dialogs without closing them on BAD_REQUEST.
 *
 * CreateProduct and UpdateProduct return the saved Product (including the nested
 * Category), which Apollo's InMemoryCache normalises under Product:<id>. The list
 * query therefore updates without an explicit refetch when an entity changes.
 *
 * DeleteProduct returns Boolean, so the cache cannot auto-update. The update
 * callback uses cache.evict() to remove the Product entity immediately so the
 * list watchQuery drops the row without a network round-trip.
 */
@Injectable({
  providedIn: 'root',
})
export class Products {
  // inject() replaces constructor injection in Angular 21
  private readonly apollo = inject(Apollo);

  /**
   * Creates a watchQuery for the paginated product list.
   *
   * Returns a QueryRef rather than an Observable so the caller can call
   * .refetch() after delete operations, after dialog closes, and when the
   * category filter changes. watchQuery keeps the subscription alive and
   * reacts to InMemoryCache updates triggered by create/update mutations
   * (which return the Product entity with its nested Category).
   *
   * The categoryId parameter is optional: null means "all products", a string
   * ID scopes the result to that category. The backend accepts null/undefined
   * as "no filter".
   *
   * @param categoryId - Category ID to filter by, or null for all products.
   * @param page - 0-based page index.
   * @param size - Number of products per page.
   * @returns Apollo QueryRef for the paginated product list.
   */
  watchProducts(
    categoryId: string | null,
    page: number,
    size: number,
  ): QueryRef<GetProductsQuery, GetProductsQueryVariables> {
    return this.apollo.watchQuery<GetProductsQuery, GetProductsQueryVariables>({
      query: GetProductsDocument,
      variables: { categoryId, page, size },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the createProduct mutation.
   *
   * The returned Product (including nested Category) is normalised into the
   * InMemoryCache. The paginated list query is not automatically updated
   * because Apollo does not know where to insert the new product in the
   * sorted/paged result. The caller must call refetch() after success.
   *
   * @param input - The product creation input (productName, unitPrice, categoryId).
   * @returns Observable of the raw mutation result.
   */
  createProduct(
    input: CreateProductMutationVariables['input'],
  ): Observable<Apollo.MutateResult<CreateProductMutation>> {
    return this.apollo.mutate<CreateProductMutation, CreateProductMutationVariables>({
      mutation: CreateProductDocument,
      variables: { input },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the updateProduct mutation.
   *
   * The returned Product is written into the cache by its __typename + id key,
   * updating every query that references this product without a manual refetch.
   * This is why the list page does not need to refetch after a successful edit.
   *
   * @param id - ID of the product to update.
   * @param input - Updated field values (productName, unitPrice, categoryId).
   * @returns Observable of the raw mutation result.
   */
  updateProduct(
    id: UpdateProductMutationVariables['id'],
    input: UpdateProductMutationVariables['input'],
  ): Observable<Apollo.MutateResult<UpdateProductMutation>> {
    return this.apollo.mutate<UpdateProductMutation, UpdateProductMutationVariables>({
      mutation: UpdateProductDocument,
      variables: { id, input },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the deleteProduct mutation and evicts the entity from the cache.
   *
   * The mutation returns Boolean, so Apollo cannot auto-update the cache.
   * The update callback uses cache.evict() to remove the normalised Product
   * entry synchronously, so the list watchQuery drops the row without a
   * network round-trip. cache.gc() then collects any dangling references
   * (e.g. the Product -> Category edge that is no longer referenced).
   *
   * @param id - ID of the product to delete.
   * @returns Observable of the raw mutation result.
   */
  deleteProduct(
    id: DeleteProductMutationVariables['id'],
  ): Observable<Apollo.MutateResult<DeleteProductMutation>> {
    return this.apollo.mutate<DeleteProductMutation, DeleteProductMutationVariables>({
      mutation: DeleteProductDocument,
      variables: { id },
      errorPolicy: 'all',
      // evict() removes Product:<id> from the normalized cache so the list
      // watchQuery updates immediately without a refetch round-trip.
      update: (cache) => {
        cache.evict({ id: cache.identify({ __typename: 'Product', id }) });
        cache.gc();
      },
    });
  }
}
