import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Subject, NEVER, of } from 'rxjs';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CategoryListPage } from './category-list.page';
import { Categories } from '../../data/categories';
import { AuthService } from '../../../../core/auth/auth.service';
import { Notification } from '../../../../core/notification/notification';

/** Minimal category shape needed to populate the table template. */
const mockCategory = {
  __typename: 'Category' as const,
  id: '1',
  categoryName: 'Electronics',
};

describe('CategoryListPage', () => {
  let component: CategoryListPage;
  let fixture: ComponentFixture<CategoryListPage>;

  // Subject typed broadly -- the component only reads .loading, .error, and .data
  const valueChangesSubject = new Subject<object>();

  const categoriesMock = {
    watchCategories: vi.fn().mockReturnValue({
      valueChanges: valueChangesSubject.asObservable(),
      refetch: vi.fn().mockResolvedValue({}),
    }),
    deleteCategory: vi.fn(),
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
      imports: [CategoryListPage, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: Categories, useValue: categoriesMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: Notification, useValue: notificationMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryListPage);
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

  it('shows category rows when data loads', () => {
    fixture.detectChanges(); // ngOnInit subscribes

    valueChangesSubject.next({
      loading: false,
      data: {
        categories: {
          content: [mockCategory],
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
    expect(component.categories().length).toBe(1);
    expect(component.categories()[0].categoryName).toBe('Electronics');
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

  it('shows empty state when no categories are returned', () => {
    fixture.detectChanges();

    valueChangesSubject.next({
      loading: false,
      data: {
        categories: {
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 0,
          size: 10,
        },
      },
    });

    fixture.detectChanges();

    expect(component.categories().length).toBe(0);
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  it('opens a confirmation dialog when deleteCategory is called', () => {
    fixture.detectChanges();

    // Emit data so the table renders and we can call deleteCategory
    valueChangesSubject.next({
      loading: false,
      data: {
        categories: {
          content: [mockCategory],
          totalElements: 1,
          totalPages: 1,
          page: 0,
          size: 10,
        },
      },
    });
    fixture.detectChanges();

    component.deleteCategory(mockCategory);

    // dialog.open should be called with ConfirmDialog data
    expect(dialogMock.open).toHaveBeenCalledOnce();
  });

  it('calls categoriesService.deleteCategory after confirmation and notifies on success', () => {
    fixture.detectChanges();

    // Simulate dialog confirming (afterClosed emits true)
    dialogMock.open.mockReturnValue({ afterClosed: () => of(true) });
    // Simulate successful delete mutation
    categoriesMock.deleteCategory.mockReturnValue(of({ data: { deleteCategory: true } }));

    component.deleteCategory(mockCategory);

    expect(categoriesMock.deleteCategory).toHaveBeenCalledWith('1');
    expect(notificationMock.success).toHaveBeenCalledWith('Category deleted successfully.');
  });

  it('shows notification error when deleteCategory returns a BAD_REQUEST error', () => {
    fixture.detectChanges();

    dialogMock.open.mockReturnValue({ afterClosed: () => of(true) });

    // Simulate a BAD_REQUEST response (category has products)
    const apolloError = new Error('Category still has products') as Error & {
      errors: { message: string; extensions: { classification: string } }[];
    };
    apolloError.errors = [
      {
        message: 'Category still has products',
        extensions: { classification: 'BAD_REQUEST' },
      },
    ];
    categoriesMock.deleteCategory.mockReturnValue(of({ error: apolloError }));

    component.deleteCategory(mockCategory);

    // notification.error should be called with the backend message
    expect(notificationMock.error).toHaveBeenCalled();
  });

  it('does not show create/edit/delete actions for non-admin users', () => {
    // Set the user as non-admin
    authServiceMock.isAdmin.set(false);
    fixture.detectChanges();

    // Emit data so the table renders
    valueChangesSubject.next({
      loading: false,
      data: {
        categories: {
          content: [mockCategory],
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
    const editButtons = fixture.nativeElement.querySelectorAll('[mattooltip="Edit category"]');
    const deleteButtons = fixture.nativeElement.querySelectorAll('[mattooltip="Delete category"]');
    expect(editButtons.length).toBe(0);
    expect(deleteButtons.length).toBe(0);
  });
});
