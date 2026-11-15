import { TestBed } from '@angular/core/testing';
// ApolloTestingModule is the correct testing export from apollo-angular/testing.
// provideApolloTesting() does not exist in this package version -- the module
// must be listed under imports, not providers, because it is an NgModule that
// registers Apollo providers internally.
import { ApolloTestingController, ApolloTestingModule } from 'apollo-angular/testing';
import { Orders } from './orders';
import {
  CreateOrderDocument,
  GetCustomerOptionsDocument,
  GetOrderDocument,
  GetOrdersDocument,
  GetProductOptionsDocument,
  OrderCreatedDocument,
} from '../../../core/graphql/generated/graphql';

/**
 * Unit tests for OrdersService.
 *
 * ApolloTestingModule supplies a lightweight Apollo client that intercepts all
 * operations without a real network. ApolloTestingController lets us assert
 * that the service sends the correct document and variables.
 */
describe('Orders', () => {
  let service: Orders;
  let controller: ApolloTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // ApolloTestingModule registers a mock Apollo client in the test injector
      imports: [ApolloTestingModule],
    });
    service = TestBed.inject(Orders);
    controller = TestBed.inject(ApolloTestingController);
  });

  afterEach(() => {
    // Verify that no unexpected operations were sent after each test
    controller.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('watchOrders sends GetOrdersDocument with correct variables', () => {
    const queryRef = service.watchOrders('c1', 0, 10);

    queryRef.valueChanges.subscribe();

    const op = controller.expectOne(GetOrdersDocument);

    expect(op.operation.variables['customerId']).toBe('c1');
    expect(op.operation.variables['page']).toBe(0);
    expect(op.operation.variables['size']).toBe(10);

    op.flush({
      data: {
        orders: {
          __typename: 'OrderPage',
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 0,
          size: 10,
        },
      },
    });
  });

  it('watchOrders with null customerId passes null correctly', () => {
    const queryRef = service.watchOrders(null, 0, 10);

    queryRef.valueChanges.subscribe();

    const op = controller.expectOne(GetOrdersDocument);

    expect(op.operation.variables['customerId']).toBeNull();

    op.flush({
      data: {
        orders: {
          __typename: 'OrderPage',
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 0,
          size: 10,
        },
      },
    });
  });

  it('watchOrder sends GetOrderDocument with the correct id', () => {
    const queryRef = service.watchOrder('42');

    queryRef.valueChanges.subscribe();

    const op = controller.expectOne(GetOrderDocument);

    expect(op.operation.variables['id']).toBe('42');

    op.flush({
      data: {
        order: null,
      },
    });
  });

  it('watchCustomerOptions sends GetCustomerOptionsDocument', () => {
    const queryRef = service.watchCustomerOptions();

    queryRef.valueChanges.subscribe();

    const op = controller.expectOne(GetCustomerOptionsDocument);

    op.flush({
      data: {
        customers: { __typename: 'CustomerPage', content: [] },
      },
    });
  });

  it('watchProductOptions sends GetProductOptionsDocument', () => {
    const queryRef = service.watchProductOptions();

    queryRef.valueChanges.subscribe();

    const op = controller.expectOne(GetProductOptionsDocument);

    op.flush({
      data: {
        products: { __typename: 'ProductPage', content: [] },
      },
    });
  });

  it('createOrder sends CreateOrderDocument with the correct input', () => {
    const input = { customerId: 'c1', productId: 'p1', quantity: 2 };

    service.createOrder(input).subscribe();

    const op = controller.expectOne(CreateOrderDocument);

    expect(op.operation.variables['input']).toEqual(input);

    op.flush({
      data: {
        createOrder: {
          __typename: 'Order',
          id: '1',
          quantity: 2,
          total: 49.98,
          customer: {
            __typename: 'Customer',
            id: 'c1',
            firstName: 'Alice',
            lastName: 'Smith',
            telephone: '555-1234',
            email: 'alice@example.com',
            address: '123 Main St',
          },
          product: {
            __typename: 'Product',
            id: 'p1',
            productName: 'Widget',
            unitPrice: 24.99,
            category: { __typename: 'Category', id: 'cat1', categoryName: 'Electronics' },
          },
        },
      },
    });
  });

  it('subscribeToOrderCreated sends OrderCreatedDocument', () => {
    // subscribe() returns an Observable -- subscribe to start it
    service.subscribeToOrderCreated().subscribe();

    // expectOne matches the subscription operation by document
    const op = controller.expectOne(OrderCreatedDocument);

    op.flush({
      data: {
        orderCreated: {
          __typename: 'Order',
          id: '10',
          quantity: 1,
          total: 24.99,
          customer: {
            __typename: 'Customer',
            id: 'c2',
            firstName: 'Bob',
            lastName: 'Jones',
            telephone: '555-9999',
            email: 'bob@example.com',
            address: '456 Oak Ave',
          },
          product: {
            __typename: 'Product',
            id: 'p2',
            productName: 'Gadget',
            unitPrice: 24.99,
            category: { __typename: 'Category', id: 'cat1', categoryName: 'Electronics' },
          },
        },
      },
    });
  });
});
