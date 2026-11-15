import { TestBed } from '@angular/core/testing';
// ApolloTestingModule is the correct testing export from apollo-angular/testing.
// provideApolloTesting() does not exist in this package version -- the module
// must be listed under imports, not providers, because it is an NgModule that
// registers Apollo providers internally.
import { ApolloTestingController, ApolloTestingModule } from 'apollo-angular/testing';
import { Products } from './products';
import {
  CreateProductDocument,
  GetProductsDocument,
  UpdateProductDocument,
} from '../../../core/graphql/generated/graphql';

/**
 * Unit tests for ProductsService.
 *
 * ApolloTestingModule supplies a lightweight Apollo client that intercepts all
 * operations without a real network. ApolloTestingController lets us assert
 * that the service sends the correct document and variables.
 */
describe('Products', () => {
  let service: Products;
  let controller: ApolloTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // ApolloTestingModule registers a mock Apollo client in the test injector
      imports: [ApolloTestingModule],
    });
    service = TestBed.inject(Products);
    controller = TestBed.inject(ApolloTestingController);
  });

  afterEach(() => {
    // Verify that no unexpected operations were sent after each test
    controller.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('watchProducts sends GetProductsDocument with correct variables', () => {
    // Call the method under test -- this creates the watchQuery internally
    const queryRef = service.watchProducts(null, 2, 20);

    // Subscribe to trigger the actual Apollo call
    queryRef.valueChanges.subscribe();

    // expect() on the controller asserts the operation was sent and returns it
    const op = controller.expectOne(GetProductsDocument);

    // Verify all variables are forwarded correctly
    expect(op.operation.variables['categoryId']).toBeNull();
    expect(op.operation.variables['page']).toBe(2);
    expect(op.operation.variables['size']).toBe(20);

    // Flush with minimal data so the observable completes cleanly
    op.flush({
      data: {
        products: {
          __typename: 'ProductPage',
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 2,
          size: 20,
        },
      },
    });
  });

  it('watchProducts forwards a categoryId filter when provided', () => {
    const queryRef = service.watchProducts('42', 0, 10);

    queryRef.valueChanges.subscribe();

    const op = controller.expectOne(GetProductsDocument);

    // The list is one request even when filtered -- no N+1 per row
    expect(op.operation.variables['categoryId']).toBe('42');
    expect(op.operation.variables['page']).toBe(0);
    expect(op.operation.variables['size']).toBe(10);

    op.flush({
      data: {
        products: {
          __typename: 'ProductPage',
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 0,
          size: 10,
        },
      },
    });
  });

  it('createProduct sends CreateProductDocument with the correct input', () => {
    const input = { productName: 'Widget', unitPrice: 9.99, categoryId: '10' };

    service.createProduct(input).subscribe();

    const op = controller.expectOne(CreateProductDocument);

    expect(op.operation.variables['input']).toEqual(input);

    op.flush({
      data: {
        createProduct: {
          __typename: 'Product',
          id: '1',
          productName: 'Widget',
          unitPrice: 9.99,
          category: { __typename: 'Category', id: '10', categoryName: 'Electronics' },
        },
      },
    });
  });

  it('updateProduct sends UpdateProductDocument with the correct id and input', () => {
    const id = '5';
    const input = { productName: 'Widget Pro', unitPrice: 19.99, categoryId: '10' };

    service.updateProduct(id, input).subscribe();

    const op = controller.expectOne(UpdateProductDocument);

    expect(op.operation.variables['id']).toBe(id);
    expect(op.operation.variables['input']).toEqual(input);

    op.flush({
      data: {
        updateProduct: {
          __typename: 'Product',
          id: '5',
          productName: 'Widget Pro',
          unitPrice: 19.99,
          category: { __typename: 'Category', id: '10', categoryName: 'Electronics' },
        },
      },
    });
  });

  it('deleteProduct sends the deleteProduct operation with the correct id', () => {
    const id = '42';

    service.deleteProduct(id).subscribe();

    const op = controller.expectOne(
      // DeleteProductDocument matches the deleteProduct mutation document
      (testOp) => testOp.operationName === 'DeleteProduct',
    );

    expect(op.operation.variables['id']).toBe(id);

    op.flush({ data: { deleteProduct: true } });
  });
});
