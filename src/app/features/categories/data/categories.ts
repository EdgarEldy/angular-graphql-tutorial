import { inject, Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable } from 'rxjs';
import type { QueryRef } from 'apollo-angular';
import {
  CreateCategoryDocument,
  type CreateCategoryMutation,
  type CreateCategoryMutationVariables,
  DeleteCategoryDocument,
  type DeleteCategoryMutation,
  type DeleteCategoryMutationVariables,
  GetCategoriesDocument,
  type GetCategoriesQuery,
  type GetCategoriesQueryVariables,
  GetCategoryOptionsDocument,
  type GetCategoryOptionsQuery,
  type GetCategoryOptionsQueryVariables,
  UpdateCategoryDocument,
  type UpdateCategoryMutation,
  type UpdateCategoryMutationVariables,
} from '../../../core/graphql/generated/graphql';

/**
 * Feature service for the Categories section.
 *
 * Wraps Apollo queries and mutations for category management. No UI logic
 * lives here: no snackbars, no navigation, no dialog interactions. All Apollo
 * calls use errorPolicy:'all' so callers can inspect both data and errors,
 * enabling inline error display in dialogs without closing them on BAD_REQUEST.
 *
 * CreateCategory and UpdateCategory return the saved Category, which Apollo's
 * InMemoryCache normalises under Category:<id>. The list query is therefore
 * updated without an explicit refetch when an entity changes.
 *
 * DeleteCategory returns Boolean, so the cache cannot auto-update. The caller
 * must call refetch() after a successful delete.
 */
@Injectable({
  providedIn: 'root',
})
export class Categories {
  // inject() replaces constructor injection in Angular 21
  private readonly apollo = inject(Apollo);

  /**
   * Creates a watchQuery for the paginated category list.
   *
   * Returns a QueryRef rather than an Observable so the caller can call
   * .refetch() after delete operations and after dialog closes. watchQuery
   * keeps the subscription alive and reacts to InMemoryCache updates triggered
   * by create/update mutations (which return the Category entity).
   *
   * @param page - 0-based page index.
   * @param size - Number of categories per page.
   * @returns Apollo QueryRef for the paginated category list.
   */
  watchCategories(
    page: number,
    size: number,
  ): QueryRef<GetCategoriesQuery, GetCategoriesQueryVariables> {
    return this.apollo.watchQuery<GetCategoriesQuery, GetCategoriesQueryVariables>({
      query: GetCategoriesDocument,
      variables: { page, size },
      errorPolicy: 'all',
    });
  }

  /**
   * Creates a watchQuery for the flat category options list.
   *
   * Requests up to 1000 categories (page 0, size 1000) so the caller can use
   * this as a flat select list without pagination. Used by CategoryOptionsService
   * and the product form's category select.
   *
   * @returns Apollo QueryRef for the flat category options list.
   */
  watchCategoryOptions(): QueryRef<GetCategoryOptionsQuery, GetCategoryOptionsQueryVariables> {
    return this.apollo.watchQuery<GetCategoryOptionsQuery, GetCategoryOptionsQueryVariables>({
      query: GetCategoryOptionsDocument,
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the createCategory mutation.
   *
   * The returned Category is normalised into the InMemoryCache. The paginated
   * list query is not automatically updated (Apollo does not know where to
   * insert the new category in the sorted/paged result). The caller must call
   * refetch() after success.
   *
   * @param input - The category creation input (categoryName).
   * @returns Observable of the raw mutation result.
   */
  createCategory(
    input: CreateCategoryMutationVariables['input'],
  ): Observable<Apollo.MutateResult<CreateCategoryMutation>> {
    return this.apollo.mutate<CreateCategoryMutation, CreateCategoryMutationVariables>({
      mutation: CreateCategoryDocument,
      variables: { input },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the updateCategory mutation.
   *
   * The returned Category is written into the cache by its __typename + id key,
   * updating every query that references this category without a manual refetch.
   * This is why the list page does not need to refetch after a successful edit.
   *
   * @param id - ID of the category to update.
   * @param input - Updated field values (categoryName).
   * @returns Observable of the raw mutation result.
   */
  updateCategory(
    id: UpdateCategoryMutationVariables['id'],
    input: UpdateCategoryMutationVariables['input'],
  ): Observable<Apollo.MutateResult<UpdateCategoryMutation>> {
    return this.apollo.mutate<UpdateCategoryMutation, UpdateCategoryMutationVariables>({
      mutation: UpdateCategoryDocument,
      variables: { id, input },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the deleteCategory mutation and evicts the entity from the cache.
   *
   * The mutation returns Boolean, so Apollo cannot auto-update the cache.
   * The update callback uses cache.evict() to remove the normalised Category
   * entry synchronously, so the list watchQuery drops the row without a
   * network round-trip. cache.gc() then collects any dangling references.
   *
   * A BAD_REQUEST error is returned when the category still has associated
   * products. The caller is responsible for surfacing the backend message via
   * the notification service (this service performs no UI logic).
   *
   * @param id - ID of the category to delete.
   * @returns Observable of the raw mutation result.
   */
  deleteCategory(
    id: DeleteCategoryMutationVariables['id'],
  ): Observable<Apollo.MutateResult<DeleteCategoryMutation>> {
    return this.apollo.mutate<DeleteCategoryMutation, DeleteCategoryMutationVariables>({
      mutation: DeleteCategoryDocument,
      variables: { id },
      errorPolicy: 'all',
      // evict() removes Category:<id> from the normalized cache so the list
      // watchQuery updates immediately without a refetch round-trip.
      update: (cache) => {
        cache.evict({ id: cache.identify({ __typename: 'Category', id }) });
        cache.gc();
      },
    });
  }
}
