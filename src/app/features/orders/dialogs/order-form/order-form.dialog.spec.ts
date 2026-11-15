import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { of, Subject } from 'rxjs';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { OrderFormDialog } from './order-form.dialog';
import { Orders } from '../../data/orders';
import { Notification } from '../../../../core/notification/notification';

/**
 * Builds a real CombinedGraphQLErrors instance so mapError() classifies the
 * error correctly. A plain Error with a manually attached .errors array does
 * not pass CombinedGraphQLErrors.is(), which mapError() uses to detect GraphQL errors.
 */
function makeCombinedError(classification: string, message: string): CombinedGraphQLErrors {
  return new CombinedGraphQLErrors({
    errors: [{ message, extensions: { classification } }],
  });
}

/** Product used in the estimate-preview tests. */
const mockProduct = {
  __typename: 'Product' as const,
  id: 'p1',
  productName: 'Widget',
  unitPrice: 10.0,
  category: {
    __typename: 'Category' as const,
    id: 'cat1',
    categoryName: 'Electronics',
  },
};

/** Customer used in the form submission tests. */
const mockCustomer = {
  __typename: 'Customer' as const,
  id: 'c1',
  firstName: 'Alice',
  lastName: 'Smith',
  telephone: '555-1234',
  email: 'alice@example.com',
  address: '123 Main St',
};

/** Order returned by a successful createOrder mutation. */
const mockSavedOrder = {
  __typename: 'Order' as const,
  id: '99',
  quantity: 3,
  total: 30.0, // server total
  customer: mockCustomer,
  product: mockProduct,
};

describe('OrderFormDialog', () => {
  let component: OrderFormDialog;
  let fixture: ComponentFixture<OrderFormDialog>;

  const customerOptionsSubject = new Subject<object>();
  const productOptionsSubject = new Subject<object>();

  const ordersMock = {
    watchCustomerOptions: vi.fn().mockReturnValue({
      valueChanges: customerOptionsSubject.asObservable(),
    }),
    watchProductOptions: vi.fn().mockReturnValue({
      valueChanges: productOptionsSubject.asObservable(),
    }),
    createOrder: vi.fn(),
  };

  const dialogRefMock = { close: vi.fn() };

  const notificationMock = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [OrderFormDialog, NoopAnimationsModule],
      providers: [
        { provide: Orders, useValue: ordersMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: Notification, useValue: notificationMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges(); // triggers ngOnInit
  });

  // -- Form state --

  it('form is invalid when required fields are empty', () => {
    expect(component.form.invalid).toBe(true);
  });

  it('quantity control defaults to 1', () => {
    expect(component.form.controls.quantity.value).toBe(1);
  });

  it('form is invalid when quantity is less than 1', () => {
    component.form.controls.customerId.setValue('c1');
    component.form.controls.productId.setValue('p1');
    component.form.controls.quantity.setValue(0);

    expect(component.form.invalid).toBe(true);
    expect(component.form.controls.quantity.hasError('min')).toBe(true);
  });

  it('form is valid with all required fields and quantity >= 1', () => {
    component.form.controls.customerId.setValue('c1');
    component.form.controls.productId.setValue('p1');
    component.form.controls.quantity.setValue(2);

    expect(component.form.valid).toBe(true);
  });

  // -- Estimated total preview --

  it('estimated total is 0 before product and quantity are set', () => {
    // Default state: no product selected, quantity = 1
    expect(component.estimatedTotal()).toBe(0);
  });

  it('estimated total updates when product is selected', () => {
    // Emit product options so the dialog knows the unit price
    productOptionsSubject.next({
      data: { products: { content: [mockProduct] } },
    });

    fixture.detectChanges();

    // Select the product (triggers productId.valueChanges -> selectedUnitPrice signal)
    component.form.controls.productId.setValue('p1');
    fixture.detectChanges();

    // estimatedTotal = currentQuantity (1) * selectedUnitPrice (10.0) = 10
    expect(component.estimatedTotal()).toBe(10.0);
  });

  it('estimated total updates when quantity changes', () => {
    productOptionsSubject.next({
      data: { products: { content: [mockProduct] } },
    });

    fixture.detectChanges();

    component.form.controls.productId.setValue('p1');
    component.form.controls.quantity.setValue(5);
    fixture.detectChanges();

    // estimatedTotal = currentQuantity (5) * selectedUnitPrice (10.0) = 50
    expect(component.estimatedTotal()).toBe(50.0);
  });

  it('server total in closed dialog result differs from estimate after creation', () => {
    // Arrange: set up the form with product at 10.0/unit, quantity 3 (estimate = 30)
    productOptionsSubject.next({
      data: { products: { content: [mockProduct] } },
    });
    fixture.detectChanges();

    component.form.controls.customerId.setValue('c1');
    component.form.controls.productId.setValue('p1');
    component.form.controls.quantity.setValue(3);
    fixture.detectChanges();

    expect(component.estimatedTotal()).toBe(30.0); // client estimate

    // Act: createOrder returns the server order (same total in this case, but
    // the test verifies the dialog closes with the server's value, not the estimate)
    ordersMock.createOrder.mockReturnValue(of({ data: { createOrder: mockSavedOrder } }));
    component.submit();

    // The dialog should close with the server's order (not the client estimate)
    expect(dialogRefMock.close).toHaveBeenCalledWith(mockSavedOrder);
    expect(notificationMock.success).toHaveBeenCalledWith('Order #99 created.');
  });

  // -- Mutation error handling --

  it('does not call createOrder when form is invalid', () => {
    component.submit();

    expect(ordersMock.createOrder).not.toHaveBeenCalled();
  });

  it('does not call createOrder when loading is true (double-submit guard)', () => {
    // Make the form valid so the only active guard is loading
    component.form.controls.customerId.setValue('c1');
    component.form.controls.productId.setValue('p1');
    component.form.controls.quantity.setValue(1);

    // Simulate an in-flight request by setting the loading signal to true
    component.loading.set(true);
    component.submit();

    // submit() must return early without dispatching a second mutation
    expect(ordersMock.createOrder).not.toHaveBeenCalled();
  });

  it('shows inline error on BAD_REQUEST and keeps dialog open', () => {
    component.form.controls.customerId.setValue('c1');
    component.form.controls.productId.setValue('p1');
    component.form.controls.quantity.setValue(1);

    const apolloError = makeCombinedError('BAD_REQUEST', 'Invalid order quantity');
    ordersMock.createOrder.mockReturnValue(of({ error: apolloError }));

    component.submit();

    expect(dialogRefMock.close).not.toHaveBeenCalled();
    expect(component.errorMessage()).not.toBeNull();
  });

  it('shows snackbar and closes dialog on non-BAD_REQUEST error', () => {
    component.form.controls.customerId.setValue('c1');
    component.form.controls.productId.setValue('p1');
    component.form.controls.quantity.setValue(1);

    const apolloError = makeCombinedError('FORBIDDEN', 'Not allowed');
    ordersMock.createOrder.mockReturnValue(of({ error: apolloError }));

    component.submit();

    expect(notificationMock.error).toHaveBeenCalled();
    expect(dialogRefMock.close).toHaveBeenCalled();
  });

  it('sends correct input to createOrder mutation', () => {
    component.form.controls.customerId.setValue('c1');
    component.form.controls.productId.setValue('p1');
    component.form.controls.quantity.setValue(3);

    ordersMock.createOrder.mockReturnValue(of({ data: { createOrder: mockSavedOrder } }));
    component.submit();

    expect(ordersMock.createOrder).toHaveBeenCalledWith({
      customerId: 'c1',
      productId: 'p1',
      quantity: 3,
    });
  });
});
