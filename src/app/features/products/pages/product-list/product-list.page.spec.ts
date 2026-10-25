import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Subject, NEVER, of } from 'rxjs';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ProductListPage } from './product-list.page';
import { Products } from '../../data/products';
import { CategoryOptions } from '../../../categories/data/category-options';
import { AuthService } from '../../../../core/auth/auth.service';
import { Notification } from '../../../../core/notification/notification';

/** Minimal product shape needed to populate the table template. */
const mockProduct = {
  __typename: 'Product' as const,
  id: '1',
  productName: 'Laptop',
  unitPrice: 999.99,
  category: {
    __typename: 'Category' as const,
    id: '10',
    categoryName: 'Electronics',
  },
};

describe('ProductListPage', () => {
  let component: ProductListPage;
  let fixture: ComponentFixture<ProductListPage>;

  // Subject typed broadly -- the component only reads .loading, .error, and .data
  const valueChangesSubject = new Subject<object>();
  const categoryValueChangesSubject = new Subject<object>();

  const productsRefetchMock = vi.fn().mockResolvedValue({});

  const productsMock = {
    watchProducts: vi.fn().mockReturnValue({
      valueChanges: valueChangesSubject.asObservable(),
      refetch: productsRefetchMock,
    }),
    deleteProduct: vi.fn(),
  };

  const categoryOptionsMock = {
    watchOptions: vi.fn().mockReturnValue({
      valueChanges: categoryValueChangesSubject.asObservable(),
      refetch: vi.fn().mockResolvedValue({}),
    }),
  };

  // isAdmin() is used to show/hide admin actions and the Create button
  const authServiceMock = {
    currentUser: signal<{ id: string } | null>(null),
    // Admin by default so the Create and action buttons render in most tests
    isAdmin: signal(true),
  };

  const dialogMock = {
    open: vi.fn().mockReturnValue({ afterClosed: () => NEVER }),
  };

  const notificationMock = {
    success: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset to admin for each test; individual tests can override
    authServiceMock.isAdmin.set(true);

    await TestBed.configureTestingModule({
      imports: [ProductListPage, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: Products, useValue: productsMock },
        { provide: CategoryOptions, useValue: categoryOptionsMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: Notification, useValue: notificationMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductListPage);
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

  it('shows product rows when data loads', () => {
    fixture.detectChanges(); // ngOnInit subscribes

    valueChangesSubject.next({
      loading: false,
      data: {
        products: {
          content: [mockProduct],
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
    expect(component.products().length).toBe(1);
    expect(component.products()[0].productName).toBe('Laptop');
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

  it('shows empty state when no products are returned', () => {
    fixture.detectChanges();

    valueChangesSubject.next({
      loading: false,
      data: {
        products: {
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 0,
          size: 10,
        },
      },
    });

    fixture.detectChanges();

    expect(component.products().length).toBe(0);
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  it('resets pageIndex to 0 when the category filter changes', () => {
    fixture.detectChanges();

    // Start on page 2
    component.pageIndex.set(2);

    // Change the category filter
    component.onCategoryChange('10');

    // pageIndex must be reset so the user sees the first page of the filtered results
    expect(component.pageIndex()).toBe(0);
    expect(component.selectedCategoryId()).toBe('10');
    expect(productsRefetchMock).toHaveBeenCalledWith({
      categoryId: '10',
      page: 0,
      size: 10,
    });
  });

  it('preserves the active category filter when changing pages', () => {
    fixture.detectChanges();

    component.selectedCategoryId.set('10');

    component.onPageChange({ pageIndex: 2, pageSize: 10, length: 30 });

    expect(productsRefetchMock).toHaveBeenCalledWith({
      categoryId: '10',
      page: 2,
      size: 10,
    });
  });

  it('opens a confirmation dialog when deleteProduct is called', () => {
    fixture.detectChanges();

    component.deleteProduct(mockProduct);

    expect(dialogMock.open).toHaveBeenCalledOnce();
  });

  it('calls productsService.deleteProduct after confirmation and notifies on success', () => {
    fixture.detectChanges();

    // Simulate dialog confirming (afterClosed emits true)
    dialogMock.open.mockReturnValue({ afterClosed: () => of(true) });
    // Simulate successful delete mutation
    productsMock.deleteProduct.mockReturnValue(of({ data: { deleteProduct: true } }));

    component.deleteProduct(mockProduct);

    expect(productsMock.deleteProduct).toHaveBeenCalledWith('1');
    expect(notificationMock.success).toHaveBeenCalledWith('Product deleted successfully.');
  });

  it('does not show create/edit/delete actions for non-admin users', () => {
    // Set the user as non-admin
    authServiceMock.isAdmin.set(false);
    fixture.detectChanges();

    // Emit data so the table renders
    valueChangesSubject.next({
      loading: false,
      data: {
        products: {
          content: [mockProduct],
          totalElements: 1,
          totalPages: 1,
          page: 0,
          size: 10,
        },
      },
    });
    fixture.detectChanges();

    // The Create button should not be rendered (headerActionLabel() returns undefined)
    expect(component.headerActionLabel()).toBeUndefined();

    // The edit and delete icon buttons are inside @if(isAdmin()) so they must not appear
    const editButtons = fixture.nativeElement.querySelectorAll('[mattooltip="Edit product"]');
    const deleteButtons = fixture.nativeElement.querySelectorAll('[mattooltip="Delete product"]');
    expect(editButtons.length).toBe(0);
    expect(deleteButtons.length).toBe(0);
  });
});
