import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { CustomerFormDialog, type CustomerFormDialogData } from './customer-form.dialog';
import { Customers } from '../../data/customers';
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

/** Full CustomerFieldsFragment shape required by CustomerFormDialogData. */
const existingCustomer = {
  __typename: 'Customer' as const,
  id: '5',
  firstName: 'Alice',
  lastName: 'Smith',
  telephone: '555-1234',
  email: 'alice@example.com',
  address: '123 Main St',
};

describe('CustomerFormDialog', () => {
  let component: CustomerFormDialog;
  let fixture: ComponentFixture<CustomerFormDialog>;

  const customersMock = {
    createCustomer: vi.fn(),
    updateCustomer: vi.fn(),
  };

  const dialogRefMock = { close: vi.fn() };

  const notificationMock = {
    success: vi.fn(),
    error: vi.fn(),
  };

  /**
   * Creates the component with the given dialog data.
   *
   * TestBed.overrideProvider() must be called before createComponent() so Angular
   * uses the new value when instantiating the component.
   */
  function setup(data: CustomerFormDialogData): void {
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: data });
    fixture = TestBed.createComponent(CustomerFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [CustomerFormDialog, NoopAnimationsModule],
      providers: [
        { provide: Customers, useValue: customersMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: Notification, useValue: notificationMock },
        // Provide a default value; individual tests override it via setup()
        { provide: MAT_DIALOG_DATA, useValue: { customer: null } },
      ],
    }).compileComponents();
  });

  // -- Create mode --

  it('renders create form when no customer data is passed', () => {
    setup({ customer: null });

    expect(component.isEdit()).toBe(false);
    expect(component.title()).toBe('Create customer');
    expect(component.form.controls.firstName.value).toBe('');
    expect(component.form.controls.lastName.value).toBe('');
    expect(component.form.controls.telephone.value).toBe('');
    expect(component.form.controls.email.value).toBe('');
    expect(component.form.controls.address.value).toBe('');
  });

  it('marks form invalid when required fields are empty in create mode', () => {
    setup({ customer: null });

    // All fields are empty and required, so the form is invalid
    expect(component.form.invalid).toBe(true);
  });

  it('marks form invalid when email format is wrong', () => {
    setup({ customer: null });

    component.form.controls.firstName.setValue('Alice');
    component.form.controls.lastName.setValue('Smith');
    component.form.controls.telephone.setValue('555-1234');
    component.form.controls.email.setValue('not-an-email');
    component.form.controls.address.setValue('123 Main St');

    expect(component.form.controls.email.hasError('email')).toBe(true);
    expect(component.form.invalid).toBe(true);
  });

  it('marks form valid with all required fields and valid email', () => {
    setup({ customer: null });

    component.form.controls.firstName.setValue('Alice');
    component.form.controls.lastName.setValue('Smith');
    component.form.controls.telephone.setValue('555-1234');
    component.form.controls.email.setValue('alice@example.com');
    component.form.controls.address.setValue('123 Main St');

    expect(component.form.valid).toBe(true);
  });

  it('does not call createCustomer when form is invalid', () => {
    setup({ customer: null });

    component.submit();

    expect(customersMock.createCustomer).not.toHaveBeenCalled();
  });

  it('calls createCustomer with the correct input and closes dialog on success', () => {
    setup({ customer: null });

    component.form.controls.firstName.setValue('Bob');
    component.form.controls.lastName.setValue('Jones');
    component.form.controls.telephone.setValue('555-9999');
    component.form.controls.email.setValue('bob@example.com');
    component.form.controls.address.setValue('456 Oak Ave');

    customersMock.createCustomer.mockReturnValue(
      of({
        data: {
          createCustomer: {
            __typename: 'Customer',
            id: '99',
            firstName: 'Bob',
            lastName: 'Jones',
            telephone: '555-9999',
            email: 'bob@example.com',
            address: '456 Oak Ave',
          },
        },
      }),
    );

    component.submit();

    expect(customersMock.createCustomer).toHaveBeenCalledWith({
      firstName: 'Bob',
      lastName: 'Jones',
      telephone: '555-9999',
      email: 'bob@example.com',
      address: '456 Oak Ave',
    });
    expect(notificationMock.success).toHaveBeenCalledWith('Customer created successfully.');
    expect(dialogRefMock.close).toHaveBeenCalled();
  });

  // -- Edit mode --

  it('renders edit form with pre-filled values when customer data is passed', () => {
    setup({ customer: existingCustomer });

    expect(component.isEdit()).toBe(true);
    expect(component.title()).toBe('Edit customer');
    expect(component.form.controls.firstName.value).toBe('Alice');
    expect(component.form.controls.lastName.value).toBe('Smith');
    expect(component.form.controls.telephone.value).toBe('555-1234');
    expect(component.form.controls.email.value).toBe('alice@example.com');
    expect(component.form.controls.address.value).toBe('123 Main St');
  });

  it('calls updateCustomer with the correct id and input on submit in edit mode', () => {
    setup({ customer: existingCustomer });

    component.form.controls.firstName.setValue('Alice');
    component.form.controls.lastName.setValue('Johnson');
    component.form.controls.telephone.setValue('555-5678');
    component.form.controls.email.setValue('alice.johnson@example.com');
    component.form.controls.address.setValue('789 Elm St');

    customersMock.updateCustomer.mockReturnValue(
      of({
        data: {
          updateCustomer: {
            __typename: 'Customer',
            id: '5',
            firstName: 'Alice',
            lastName: 'Johnson',
            telephone: '555-5678',
            email: 'alice.johnson@example.com',
            address: '789 Elm St',
          },
        },
      }),
    );

    component.submit();

    expect(customersMock.updateCustomer).toHaveBeenCalledWith('5', {
      firstName: 'Alice',
      lastName: 'Johnson',
      telephone: '555-5678',
      email: 'alice.johnson@example.com',
      address: '789 Elm St',
    });
    expect(notificationMock.success).toHaveBeenCalledWith('Customer updated successfully.');
    expect(dialogRefMock.close).toHaveBeenCalled();
  });

  // -- BAD_REQUEST error handling --

  it('shows inline error message and keeps dialog open on BAD_REQUEST', () => {
    setup({ customer: null });

    component.form.controls.firstName.setValue('Alice');
    component.form.controls.lastName.setValue('Smith');
    component.form.controls.telephone.setValue('555-1234');
    component.form.controls.email.setValue('alice@example.com');
    component.form.controls.address.setValue('123 Main St');

    // Use a real CombinedGraphQLErrors so mapError() classifies it as BAD_REQUEST.
    // A plain Error with a manually-attached .errors array does not pass the
    // CombinedGraphQLErrors.is() instanceof check that mapError() relies on.
    const apolloError = makeCombinedError('BAD_REQUEST', 'Email already in use');

    customersMock.createCustomer.mockReturnValue(of({ error: apolloError }));

    component.submit();

    // The dialog must stay open (close() not called)
    expect(dialogRefMock.close).not.toHaveBeenCalled();
    // An inline error message should be set
    expect(component.errorMessage()).not.toBeNull();
  });

  it('calls notification.error and closes dialog on non-BAD_REQUEST error', () => {
    setup({ customer: null });

    component.form.controls.firstName.setValue('Alice');
    component.form.controls.lastName.setValue('Smith');
    component.form.controls.telephone.setValue('555-1234');
    component.form.controls.email.setValue('alice@example.com');
    component.form.controls.address.setValue('123 Main St');

    const apolloError = makeCombinedError('FORBIDDEN', 'Not allowed');

    customersMock.createCustomer.mockReturnValue(of({ error: apolloError }));

    component.submit();

    expect(notificationMock.error).toHaveBeenCalled();
    expect(dialogRefMock.close).toHaveBeenCalled();
  });
});
