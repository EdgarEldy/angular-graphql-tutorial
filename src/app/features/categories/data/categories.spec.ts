import { TestBed } from '@angular/core/testing';
// ApolloTestingModule is the correct testing export from apollo-angular/testing.
// provideApolloTesting() does not exist in this package version -- the module
// must be listed under imports, not providers, because it is an NgModule that
// registers Apollo providers internally.
import { ApolloTestingController, ApolloTestingModule } from 'apollo-angular/testing';
import { Categories } from './categories';
import {
  CreateCategoryDocument,
  GetCategoriesDocument,
} from '../../../core/graphql/generated/graphql';

/**
 * Unit tests for CategoriesService.
 *
 * ApolloTestingModule supplies a lightweight Apollo client that intercepts all
 * operations without a real network. ApolloTestingController lets us assert
 * that the service sends the correct document and variables.
 */
describe('Categories', () => {
  let service: Categories;
  let controller: ApolloTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // ApolloTestingModule registers a mock Apollo client in the test injector
      imports: [ApolloTestingModule],
    });
    service = TestBed.inject(Categories);
    controller = TestBed.inject(ApolloTestingController);
  });

  afterEach(() => {
    // Verify that no unexpected operations were sent after each test
    controller.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('watchCategories sends GetCategoriesDocument with correct variables', () => {
    // Call the method under test -- this creates the watchQuery internally
    const queryRef = service.watchCategories(2, 20);

    // Subscribe to trigger the actual Apollo call
    queryRef.valueChanges.subscribe();

    // expect() on the controller asserts the operation was sent and returns it
    const op = controller.expectOne(GetCategoriesDocument);

    // Verify variables are forwarded correctly
    expect(op.operation.variables['page']).toBe(2);
    expect(op.operation.variables['size']).toBe(20);

    // Flush with minimal data so the observable completes cleanly
    op.flush({
      data: {
        categories: {
          __typename: 'CategoryPage',
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 2,
          size: 20,
        },
      },
    });
  });

  it('createCategory sends CreateCategoryDocument with the correct input', () => {
    const input = { categoryName: 'Electronics' };

    service.createCategory(input).subscribe();

    const op = controller.expectOne(CreateCategoryDocument);

    expect(op.operation.variables['input']).toEqual(input);

    op.flush({
      data: {
        createCategory: { __typename: 'Category', id: '1', categoryName: 'Electronics' },
      },
    });
  });

  it('propagates errors from the Apollo response', () => {
    let thrownError: Error | undefined;

    service.createCategory({ categoryName: 'Bad' }).subscribe({
      next: (result) => {
        // With errorPolicy:'all', errors come back on result.error, not as thrown exceptions.
        // The observable itself does not error out for GraphQL errors.
        thrownError = result.error as Error | undefined;
      },
    });

    const op = controller.expectOne(CreateCategoryDocument);

    // Flush with a GraphQL error that the service should forward to the caller
    op.flush({
      errors: [
        {
          message: 'Category name already exists',
          extensions: { classification: 'BAD_REQUEST' },
        },
      ],
    });

    // The result.error is set by Apollo when errorPolicy:'all' is used
    // ApolloTestingController flushes sync, so the value is available immediately
    expect(thrownError).toBeDefined();
  });
});
