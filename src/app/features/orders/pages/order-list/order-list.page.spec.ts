import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { OrderListPage } from './order-list.page';
import { Orders } from '../../data/orders';
import { Notification } from '../../../../core/notification/notification';

/** Minimal order shape used to populate the table template. */
const mockOrder = {
  __typename: 'Order' as const,
  id: '1',
  quantity: 2,
  total: 49.98,
  customer: {
    __typename: 'Customer' as const,
    id: 'c1',
    firstName: 'Alice',
    lastName: 'Smith',
    telephone: '555-1234',
    email: 'alice@example.com',
    address: '123 Main St',
  },
  product: {
    __typename: 'Product' as const,
    id: 'p1',
    productName: 'Widget',
    unitPrice: 24.99,
    category: {
      __typename: 'Category' as const,
      id: 'cat1',
      categoryName: 'Electronics',
    },
  },
};

/** Second order with a different id -- used in deduplication tests. */
const mockOrder2 = {
  ...mockOrder,
  id: '2',
  quantity: 1,
  total: 24.99,
};

describe('OrderListPage', () => {
  let component: OrderListPage;
  let fixture: ComponentFixture<OrderListPage>;

  // Subject for the main paginated query
  const ordersValueChangesSubject = new Subject<object>();
  // Subject for the customer options query
  const customerOptionsSubject = new Subject<object>();
  // Subject for the subscription observable
  const subscriptionSubject = new Subject<object>();

  const ordersRefetchMock = vi.fn().mockResolvedValue({});
  const customerOptionsRefetchMock = vi.fn().mockResolvedValue({});

  const ordersMock = {
    watchOrders: vi.fn().mockReturnValue({
      valueChanges: ordersValueChangesSubject.asObservable(),
      refetch: ordersRefetchMock,
    }),
    watchCustomerOptions: vi.fn().mockReturnValue({
      valueChanges: customerOptionsSubject.asObservable(),
      refetch: customerOptionsRefetchMock,
    }),
    subscribeToOrderCreated: vi.fn().mockReturnValue(subscriptionSubject.asObservable()),
  };

  const dialogMock = {
    open: vi.fn().mockReturnValue({ afterClosed: () => new Subject().asObservable() }),
  };

  const notificationMock = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [OrderListPage, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: Orders, useValue: ordersMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: Notification, useValue: notificationMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderListPage);
    component = fixture.componentInstance;
    // Do NOT call detectChanges here -- individual tests control when ngOnInit runs
  });

  it('shows loading state initially', () => {
    fixture.detectChanges(); // triggers ngOnInit; no emissions yet

    expect(component.loading()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-loading')).toBeTruthy();
  });

  it('shows order rows when data loads', () => {
    fixture.detectChanges();

    ordersValueChangesSubject.next({
      loading: false,
      data: {
        orders: {
          content: [mockOrder],
          totalElements: 1,
          totalPages: 1,
          page: 0,
          size: 10,
        },
      },
    });

    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.orders().length).toBe(1);
    expect(fixture.nativeElement.querySelector('app-loading')).toBeFalsy();
  });

  it('shows error banner when the query fails', () => {
    fixture.detectChanges();

    ordersValueChangesSubject.next({
      loading: false,
      error: new Error('Network failure'),
    });

    fixture.detectChanges();

    expect(component.error()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-error-banner')).toBeTruthy();
  });

  it('shows empty state when no orders are returned', () => {
    fixture.detectChanges();

    ordersValueChangesSubject.next({
      loading: false,
      data: {
        orders: { content: [], totalElements: 0, totalPages: 0, page: 0, size: 10 },
      },
    });

    fixture.detectChanges();

    expect(component.orders().length).toBe(0);
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  it('updates page signals and calls refetch on page change', () => {
    fixture.detectChanges();

    component.onPageChange({ pageIndex: 1, pageSize: 20, length: 40 });

    expect(component.pageIndex()).toBe(1);
    expect(component.pageSize()).toBe(20);
    expect(ordersRefetchMock).toHaveBeenCalledWith({
      customerId: null,
      page: 1,
      size: 20,
    });
  });

  it('resets to page 0 and refetches on customer filter change', () => {
    fixture.detectChanges();

    component.onCustomerChange('c1');

    expect(component.selectedCustomerId()).toBe('c1');
    expect(component.pageIndex()).toBe(0);
    expect(ordersRefetchMock).toHaveBeenCalledWith({
      customerId: 'c1',
      page: 0,
      size: 10,
    });
  });

  it('calls refetch on retryLoad', () => {
    fixture.detectChanges();

    component.retryLoad();

    expect(ordersRefetchMock).toHaveBeenCalledOnce();
  });

  // -- Subscription tests --

  it('prepends new order from subscription and shows info notification', () => {
    fixture.detectChanges();

    // Seed the list with one existing order
    ordersValueChangesSubject.next({
      loading: false,
      data: {
        orders: {
          content: [mockOrder],
          totalElements: 1,
          totalPages: 1,
          page: 0,
          size: 10,
        },
      },
    });

    fixture.detectChanges();

    expect(component.orders().length).toBe(1);

    // Simulate a new order arriving via the subscription (different id)
    subscriptionSubject.next({ data: { orderCreated: mockOrder2 } });

    fixture.detectChanges();

    expect(component.orders().length).toBe(2);
    // The subscription order should be prepended (first in list)
    expect(component.orders()[0].id).toBe('2');
    expect(notificationMock.info).toHaveBeenCalledWith('New order #2');
  });

  it('does not insert duplicate order when the same id arrives via subscription', () => {
    fixture.detectChanges();

    // Seed with mockOrder (id = '1')
    ordersValueChangesSubject.next({
      loading: false,
      data: {
        orders: {
          content: [mockOrder],
          totalElements: 1,
          totalPages: 1,
          page: 0,
          size: 10,
        },
      },
    });

    fixture.detectChanges();

    expect(component.orders().length).toBe(1);

    // Same id arrives via subscription (simulates current user's own order)
    subscriptionSubject.next({ data: { orderCreated: mockOrder } });

    fixture.detectChanges();

    // Must still be 1 -- no duplicate inserted
    expect(component.orders().length).toBe(1);
    // Notification is still shown even for duplicates (the user placed the order)
    expect(notificationMock.info).toHaveBeenCalledWith('New order #1');
  });

  it('sets liveStatus to disconnected when subscription errors', () => {
    fixture.detectChanges();

    expect(component.liveStatus()).toBe('connected');

    // Simulate a WebSocket error
    const apolloError = new CombinedGraphQLErrors({
      errors: [{ message: 'WebSocket closed', extensions: { classification: 'INTERNAL_ERROR' } }],
    });
    subscriptionSubject.error(apolloError);

    fixture.detectChanges();

    expect(component.liveStatus()).toBe('disconnected');
  });

  it('subscription is torn down when component is destroyed', () => {
    fixture.detectChanges();

    // takeUntilDestroyed should complete the subscription on destroy
    // We verify by checking that subscribeToOrderCreated was called and
    // no error is thrown when the component is destroyed after subscription setup
    expect(ordersMock.subscribeToOrderCreated).toHaveBeenCalledOnce();

    fixture.destroy();

    // After destroy, emitting on the subscription should NOT call info()
    vi.clearAllMocks();
    subscriptionSubject.next({ data: { orderCreated: mockOrder2 } });
    expect(notificationMock.info).not.toHaveBeenCalled();
  });
});
