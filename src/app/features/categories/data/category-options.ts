import { inject, Injectable } from '@angular/core';
import type { QueryRef } from 'apollo-angular';
import { Categories } from './categories';
import type {
  GetCategoryOptionsQuery,
  GetCategoryOptionsQueryVariables,
} from '../../../core/graphql/generated/graphql';

/**
 * Shared utility service for features that need a flat list of all categories.
 *
 * The products feature uses this service to populate the category select in
 * the product form and the category filter on the product list page. Exposing
 * the options as a dedicated service avoids duplicating the GetCategoryOptions
 * query across features and ensures that the Apollo InMemoryCache normalises
 * all Category objects under the same key regardless of which feature fetched
 * them first.
 *
 * Delegates to CategoriesService.watchCategoryOptions(), which requests up to
 * 1000 categories without pagination (page 0, size 1000). This ceiling is
 * acceptable for a category select because the total number of categories in
 * a real e-commerce catalogue is bounded in practice.
 */
@Injectable({
  providedIn: 'root',
})
export class CategoryOptions {
  // inject() replaces constructor injection in Angular 21
  private readonly categoriesService = inject(Categories);

  /**
   * Creates a watchQuery for the flat category options list.
   *
   * Returns a QueryRef so the caller can call .refetch() if the category list
   * changes while the product form is open. The QueryRef also allows the caller
   * to subscribe to live cache updates when categories are created or updated.
   *
   * @returns Apollo QueryRef for the full (unpaginated) category list.
   */
  watchOptions(): QueryRef<GetCategoryOptionsQuery, GetCategoryOptionsQueryVariables> {
    return this.categoriesService.watchCategoryOptions();
  }
}
