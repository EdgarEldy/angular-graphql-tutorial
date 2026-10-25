import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { CustomerListPage } from './customer-list.page';
import { Customers } from '../../data/customers';
import { Notification } from '../../../../core/notification/notification';

/** Minimal customer shape needed to populate the table template. */
const mockCustomer = {
  __typename: 'Customer' as const,
  id: '1',
  firstName: 'Alice',
  lastName: 'Smith',
  telephone: '555-1234',
  email: 'alice@example.com',
  address: '123 Main St',
};

describe('CustomerListPage', () => {
  let component: CustomerListPage;
  let fixture: ComponentFixture<CustomerListPage>;

  // Subject typed broadly -- the component only reads .loading, .error, and .data
  const valueChangesSubject = new Subject<object>();

  const customersRefetchMock = vi.fn().mockResolvedValue({});

  const customersMock = {
    watchCustomers: vi.fn().mockReturnValue({
      valueChanges: valueChangesSubject.asObservable(),
      refetch: customersRefetchMock,
    }),
    deleteCustomer: vi.fn(),
  };

  const dialogMock = {
    // NEVER is imported so that afterClosed() never emits unless overridden in a test
    open: vi.fn().mockReturnValue({ afterClosed: () => new Subject().asObservable() }),
  };

  const notificationMock = {
    success: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [CustomerListPage, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: Customers, useValue: customersMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: Notification, useValue: notificationMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerListPage);
    component = fixture.componentInstance;
    // Do NOT call detectChanges here -- individual tests control when ngOnInit runs
  });

  it('shows loading state initially', () => {
    // First detectChanges triggers ngOnInit; valueChangesSubject has not emitted
    // yet so loading() remains true from the signal's initial value.
    fixture.detectChanges();

    expect(component.loading()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-loading')).toBeTruthy();
  });

  it('shows customer rows when data loads', () => {
    fixture.detectChanges(); // ngOnInit subscribes

    valueChangesSubject.next({
      loading: false,
      data: {
        customers: {
          content: [mockCustomer],
          totalElements: 1,
          totalPages: 1,
          page: 0,
          size: 10,
        },
      },
    });

    // Signal changes require an explicit detectChanges to flush the view update
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.customers().length).toBe(1);
    expect(component.customers()[0].firstName).toBe('Alice');
    expect(fixture.nativeElement.querySelector('app-loading')).toBeFalsy();
  });

  it('shows error banner when the query fails', () => {
    fixture.detectChanges();

    valueChangesSubject.next({
      loading: false,
      error: new Error('Network failure'),
    });

    fixture.detectChanges();

    expect(component.error()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-error-banner')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-loading')).toBeFalsy();
  });

  it('shows empty state when no customers are returned', () => {
    fixture.detectChanges();

    valueChangesSubject.next({
      loading: false,
      data: {
        customers: {
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 0,
          size: 10,
        },
      },
    });

    fixture.detectChanges();

    expect(component.customers().length).toBe(0);
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  it('updates page signals and calls refetch on page change', () => {
    fixture.detectChanges();

    component.onPageChange({ pageIndex: 1, pageSize: 20, length: 40 });

    expect(component.pageIndex()).toBe(1);
    expect(component.pageSize()).toBe(20);
    expect(customersRefetchMock).toHaveBeenCalledWith({ page: 1, size: 20 });
  });

  it('calls refetch on retryLoad', () => {
    fixture.detectChanges();

    component.retryLoad();

    expect(customersRefetchMock).toHaveBeenCalledOnce();
  });

  it('opens a confirmation dialog when deleteCustomer is called', () => {
    fixture.detectChanges();

    component.deleteCustomer(mockCustomer);

    expect(dialogMock.open).toHaveBeenCalledOnce();
  });

  it('calls customersService.deleteCustomer after confirmation and notifies on success', () => {
    fixture.detectChanges();

    // Simulate dialog confirming (afterClosed emits true)
    dialogMock.open.mockReturnValue({ afterClosed: () => of(true) });
    // Simulate successful delete mutation
    customersMock.deleteCustomer.mockReturnValue(of({ data: { deleteCustomer: true } }));

    component.deleteCustomer(mockCustomer);

    expect(customersMock.deleteCustomer).toHaveBeenCalledWith('1');
    expect(notificationMock.success).toHaveBeenCalledWith('Customer deleted successfully.');
  });

  it('shows notification error when delete is rejected with BAD_REQUEST', () => {
    fixture.detectChanges();

    dialogMock.open.mockReturnValue({ afterClosed: () => of(true) });

    // Use a real CombinedGraphQLErrors so mapError() classifies it as BAD_REQUEST.
    // A plain Error with a manually-attached .errors array does not pass the
    // CombinedGraphQLErrors.is() instanceof check that mapError() relies on.
    const apolloError = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Cannot delete customer with existing orders',
          extensions: { classification: 'BAD_REQUEST' },
        },
      ],
    });

    customersMock.deleteCustomer.mockReturnValue(of({ error: apolloError }));

    component.deleteCustomer(mockCustomer);

    expect(customersMock.deleteCustomer).toHaveBeenCalledWith('1');
    // The error notification must surface the backend message, not a generic text
    expect(notificationMock.error).toHaveBeenCalled();
    // The dialog should NOT have been called a second time (i.e., no re-open)
    expect(dialogMock.open).toHaveBeenCalledOnce();
  });
});
