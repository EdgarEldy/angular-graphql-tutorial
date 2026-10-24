import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { CategoryFormDialog, type CategoryFormDialogData } from './category-form.dialog';
import { Categories } from '../../data/categories';
import { Notification } from '../../../../core/notification/notification';

/** Full CategoryFieldsFragment shape required by CategoryFormDialogData. */
const existingCategory = {
  __typename: 'Category' as const,
  id: '7',
  categoryName: 'Electronics',
};

describe('CategoryFormDialog', () => {
  let component: CategoryFormDialog;
  let fixture: ComponentFixture<CategoryFormDialog>;

  const categoriesMock = {
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
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
  function setup(data: CategoryFormDialogData): void {
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: data });
    fixture = TestBed.createComponent(CategoryFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [CategoryFormDialog, NoopAnimationsModule],
      providers: [
        { provide: Categories, useValue: categoriesMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: Notification, useValue: notificationMock },
        // Provide a default value; individual tests override it via setup()
        { provide: MAT_DIALOG_DATA, useValue: { category: null } },
      ],
    }).compileComponents();
  });

  // -- Create mode --

  it('renders create form when no category data is passed', () => {
    setup({ category: null });

    expect(component.isEdit()).toBe(false);
    expect(component.title()).toBe('Create category');
    // Form should be empty
    expect(component.form.controls.categoryName.value).toBe('');
  });

  it('marks form invalid when categoryName is empty in create mode', () => {
    setup({ category: null });

    // The form starts with an empty string and the required validator fires
    expect(component.form.invalid).toBe(true);
  });

  it('does not call createCategory when form is invalid', () => {
    setup({ category: null });

    component.submit();

    expect(categoriesMock.createCategory).not.toHaveBeenCalled();
  });

  it('calls createCategory with the correct input and closes dialog on success', () => {
    setup({ category: null });

    // Provide a valid form value
    component.form.controls.categoryName.setValue('Clothing');

    categoriesMock.createCategory.mockReturnValue(
      of({ data: { createCategory: { __typename: 'Category', id: '99', categoryName: 'Clothing' } } }),
    );

    component.submit();

    expect(categoriesMock.createCategory).toHaveBeenCalledWith({ categoryName: 'Clothing' });
    expect(notificationMock.success).toHaveBeenCalledWith('Category created successfully.');
    expect(dialogRefMock.close).toHaveBeenCalled();
  });

  // -- Edit mode --

  it('renders edit form with pre-filled value when category data is passed', () => {
    setup({ category: existingCategory });

    expect(component.isEdit()).toBe(true);
    expect(component.title()).toBe('Edit category');
    expect(component.form.controls.categoryName.value).toBe('Electronics');
  });

  it('calls updateCategory with the correct id and input on submit in edit mode', () => {
    setup({ category: existingCategory });

    component.form.controls.categoryName.setValue('Electronics & Gadgets');

    categoriesMock.updateCategory.mockReturnValue(
      of({
        data: {
          updateCategory: {
            __typename: 'Category',
            id: '7',
            categoryName: 'Electronics & Gadgets',
          },
        },
      }),
    );

    component.submit();

    expect(categoriesMock.updateCategory).toHaveBeenCalledWith('7', {
      categoryName: 'Electronics & Gadgets',
    });
    expect(notificationMock.success).toHaveBeenCalledWith('Category updated successfully.');
    expect(dialogRefMock.close).toHaveBeenCalled();
  });

  // -- BAD_REQUEST error handling --

  it('shows inline error message and keeps dialog open on BAD_REQUEST', () => {
    setup({ category: null });

    component.form.controls.categoryName.setValue('Duplicate');

    // Build an Apollo-like error object that mapError() will recognise as BAD_REQUEST
    const apolloError = Object.assign(new Error('Category name already exists'), {
      errors: [
        {
          message: 'Category name already exists',
          extensions: { classification: 'BAD_REQUEST' },
        },
      ],
    });

    categoriesMock.createCategory.mockReturnValue(of({ error: apolloError }));

    component.submit();

    // The dialog must stay open (close() not called)
    expect(dialogRefMock.close).not.toHaveBeenCalled();
    // An inline error message should be set
    expect(component.errorMessage()).not.toBeNull();
  });
});
