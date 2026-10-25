import { TestBed } from '@angular/core/testing';
// ApolloTestingModule is the correct testing export from apollo-angular/testing.
// provideApolloTesting() does not exist in this package version -- the module
// must be listed under imports, not providers, because it is an NgModule that
// registers Apollo providers internally.
import { ApolloTestingController, ApolloTestingModule } from 'apollo-angular/testing';
import { Customers } from './customers';
import {
  CreateCustomerDocument,
  GetCustomersDocument,
  UpdateCustomerDocument,
} from '../../../core/graphql/generated/graphql';

/**
 * Unit tests for CustomersService.
 *
 * ApolloTestingModule supplies a lightweight Apollo client that intercepts all
 * operations without a real network. ApolloTestingController lets us assert
 * that the service sends the correct document and variables.
 */
describe('Customers', () => {
  let service: Customers;
  let controller: ApolloTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // ApolloTestingModule registers a mock Apollo client in the test injector
      imports: [ApolloTestingModule],
    });
    service = TestBed.inject(Customers);
    controller = TestBed.inject(ApolloTestingController);
  });

  afterEach(() => {
    // Verify that no unexpected operations were sent after each test
    controller.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('watchCustomers sends GetCustomersDocument with correct variables', () => {
    // Call the method under test -- this creates the watchQuery internally
    const queryRef = service.watchCustomers(2, 20);

    // Subscribe to trigger the actual Apollo call
    queryRef.valueChanges.subscribe();

    // expect() on the controller asserts the operation was sent and returns it
    const op = controller.expectOne(GetCustomersDocument);

    // Verify all variables are forwarded correctly
    expect(op.operation.variables['page']).toBe(2);
    expect(op.operation.variables['size']).toBe(20);

    // Flush with minimal data so the observable completes cleanly
    op.flush({
      data: {
        customers: {
          __typename: 'CustomerPage',
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 2,
          size: 20,
        },
      },
    });
  });

  it('watchCustomers with default page 0 and size 10', () => {
    const queryRef = service.watchCustomers(0, 10);

    queryRef.valueChanges.subscribe();

    const op = controller.expectOne(GetCustomersDocument);

    expect(op.operation.variables['page']).toBe(0);
    expect(op.operation.variables['size']).toBe(10);

    op.flush({
      data: {
        customers: {
          __typename: 'CustomerPage',
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 0,
          size: 10,
        },
      },
    });
  });

  it('createCustomer sends CreateCustomerDocument with the correct input', () => {
    const input = {
      firstName: 'Alice',
      lastName: 'Smith',
      telephone: '555-1234',
      email: 'alice@example.com',
      address: '123 Main St',
    };

    service.createCustomer(input).subscribe();

    const op = controller.expectOne(CreateCustomerDocument);

    expect(op.operation.variables['input']).toEqual(input);

    op.flush({
      data: {
        createCustomer: {
          __typename: 'Customer',
          id: '1',
          firstName: 'Alice',
          lastName: 'Smith',
          telephone: '555-1234',
          email: 'alice@example.com',
          address: '123 Main St',
        },
      },
    });
  });

  it('updateCustomer sends UpdateCustomerDocument with the correct id and input', () => {
    const id = '5';
    const input = {
      firstName: 'Alice',
      lastName: 'Jones',
      telephone: '555-5678',
      email: 'alice.jones@example.com',
      address: '456 Oak Ave',
    };

    service.updateCustomer(id, input).subscribe();

    const op = controller.expectOne(UpdateCustomerDocument);

    expect(op.operation.variables['id']).toBe(id);
    expect(op.operation.variables['input']).toEqual(input);

    op.flush({
      data: {
        updateCustomer: {
          __typename: 'Customer',
          id: '5',
          firstName: 'Alice',
          lastName: 'Jones',
          telephone: '555-5678',
          email: 'alice.jones@example.com',
          address: '456 Oak Ave',
        },
      },
    });
  });

  it('deleteCustomer sends the deleteCustomer operation with the correct id', () => {
    const id = '42';

    service.deleteCustomer(id).subscribe();

    const op = controller.expectOne(
      // DeleteCustomerDocument matches the deleteCustomer mutation document
      (testOp) => testOp.operationName === 'DeleteCustomer',
    );

    expect(op.operation.variables['id']).toBe(id);

    op.flush({ data: { deleteCustomer: true } });
  });
});
