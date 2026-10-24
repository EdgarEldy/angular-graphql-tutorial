import { TestBed } from '@angular/core/testing';
// ApolloTestingModule registers the mock Apollo client needed by both
// CategoryOptions (which delegates to Categories, which injects Apollo).
import { ApolloTestingModule } from 'apollo-angular/testing';
import { CategoryOptions } from './category-options';

/**
 * Smoke test for CategoryOptionsService.
 *
 * The service delegates to CategoriesService, which injects Apollo.
 * ApolloTestingModule provides the mock Apollo client so the entire
 * dependency chain resolves without a real backend.
 */
describe('CategoryOptions', () => {
  let service: CategoryOptions;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // ApolloTestingModule registers a mock Apollo client in the test injector
      imports: [ApolloTestingModule],
    });
    service = TestBed.inject(CategoryOptions);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
