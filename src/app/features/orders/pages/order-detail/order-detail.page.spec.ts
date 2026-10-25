import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { OrderDetailPage } from './order-detail.page';
import { Orders } from '../../data/orders';

/** Full OrderFieldsFragment shape required by the detail page. */
const mockOrder = {
  __typename: 'Order' as const,
  id: '42',
  quantity: 3,
  total: 74.97,
  customer: {
    __typename: 'Customer' as const,
    id: 'c1',
    firstName: 'Bob',
    lastName: 'Jones',
    telephone: '555-9999',
    email: 'bob@example.com',
    address: '456 Oak Ave',
  },
  product: {
    __typename: 'Product' as const,
    id: 'p1',
    productName: 'Gadget',
    unitPrice: 24.99,
    category: {
      __typename: 'Category' as const,
      id: 'cat1',
      categoryName: 'Electronics',
    },
  },
};

describe('OrderDetailPage', () => {
  let component: OrderDetailPage;
  let fixture: ComponentFixture<OrderDetailPage>;

  const valueChangesSubject = new Subject<object>();
  const refetchMock = vi.fn().mockResolvedValue({});

  const ordersMock = {
    watchOrder: vi.fn().mockReturnValue({
      valueChanges: valueChangesSubject.asObservable(),
      refetch: refetchMock,
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [OrderDetailPage, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: Orders, useValue: ordersMock },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { id: '42' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderDetailPage);
    component = fixture.componentInstance;
  });

  it('shows loading state initially', () => {
    fixture.detectChanges();

    expect(component.loading()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-loading')).toBeTruthy();
  });

  it('shows order details when data loads', () => {
    fixture.detectChanges();

    valueChangesSubject.next({
      loading: false,
      data: { order: mockOrder },
    });

    fixture.detectChanges();

    expect(component.order()).toEqual(mockOrder);
    expect(component.loading()).toBe(false);
    expect(component.notFound()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-loading')).toBeFalsy();
  });

  it('sets notFound when order is null in the response', () => {
    fixture.detectChanges();

    valueChangesSubject.next({
      loading: false,
      data: { order: null },
    });

    fixture.detectChanges();

    expect(component.notFound()).toBe(true);
    expect(component.order()).toBeNull();
  });

  it('sets error signal when the query fails with a non-NOT_FOUND error', () => {
    fixture.detectChanges();

    const apolloError = new CombinedGraphQLErrors({
      errors: [{ message: 'Server error', extensions: { classification: 'INTERNAL_ERROR' } }],
    });

    valueChangesSubject.next({
      loading: false,
      error: apolloError,
    });

    fixture.detectChanges();

    expect(component.error()).not.toBeNull();
    expect(component.notFound()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-error-banner')).toBeTruthy();
  });

  it('sets notFound when the error is NOT_FOUND', () => {
    fixture.detectChanges();

    const apolloError = new CombinedGraphQLErrors({
      errors: [{ message: 'Order not found', extensions: { classification: 'NOT_FOUND' } }],
    });

    valueChangesSubject.next({
      loading: false,
      error: apolloError,
    });

    fixture.detectChanges();

    expect(component.notFound()).toBe(true);
    expect(component.error()).toBeNull();
  });

  it('calls refetch on retryLoad', () => {
    fixture.detectChanges();

    component.retryLoad();

    expect(refetchMock).toHaveBeenCalledOnce();
  });

  it('passes the correct id to watchOrder', () => {
    fixture.detectChanges();

    expect(ordersMock.watchOrder).toHaveBeenCalledWith('42');
  });
});
