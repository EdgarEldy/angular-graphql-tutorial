import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
// ApolloTestingModule registers the mock Apollo client needed by both
// CategoryOptions (which delegates to Categories, which injects Apollo).
import { ApolloTestingModule } from 'apollo-angular/testing';
import { CategoryOptions } from './category-options';
import { Categories } from './categories';
import type { QueryRef } from 'apollo-angular';
import type { GetCategoryOptionsQuery, GetCategoryOptionsQueryVariables } from '../../../core/graphql/generated/graphql';

/**
 * Unit tests for CategoryOptionsService.
 *
 * The service delegates to CategoriesService, which injects Apollo.
 * ApolloTestingModule provides the mock Apollo client so the entire
 * dependency chain resolves without a real backend.
 */
describe('CategoryOptions', () => {
  let service: CategoryOptions;
  let categoriesService: Categories;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // ApolloTestingModule registers a mock Apollo client in the test injector
      imports: [ApolloTestingModule],
    });
    service = TestBed.inject(CategoryOptions);
    categoriesService = TestBed.inject(Categories);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('watchOptions() delegates to categoriesService.watchCategoryOptions()', () => {
    // Arrange: capture the QueryRef that watchCategoryOptions() will return
    const fakeQueryRef = {} as QueryRef<GetCategoryOptionsQuery, GetCategoryOptionsQueryVariables>;
    // vi.spyOn is the Vitest equivalent of jasmine's spyOn; mockReturnValue replaces .and.returnValue()
    const spy = vi.spyOn(categoriesService, 'watchCategoryOptions').mockReturnValue(fakeQueryRef);

    // Act
    const result = service.watchOptions();

    // Assert: the delegation is in place and the same QueryRef is returned
    expect(spy).toHaveBeenCalledOnce();
    expect(result).toBe(fakeQueryRef);
  });
});
