import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, Subject } from 'rxjs';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ProductFormDialog, type ProductFormDialogData } from './product-form.dialog';
import { Products } from '../../data/products';
import { CategoryOptions } from '../../../categories/data/category-options';
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

/** Full ProductFieldsFragment shape required by ProductFormDialogData. */
const existingProduct = {
  __typename: 'Product' as const,
  id: '5',
  productName: 'Laptop',
  unitPrice: 999.99,
  category: {
    __typename: 'Category' as const,
    id: '10',
    categoryName: 'Electronics',
  },
};

const mockCategories = [
  { __typename: 'Category' as const, id: '10', categoryName: 'Electronics' },
  { __typename: 'Category' as const, id: '11', categoryName: 'Books' },
];

describe('ProductFormDialog', () => {
  let component: ProductFormDialog;
  let fixture: ComponentFixture<ProductFormDialog>;

  const categoryValueChangesSubject = new Subject<object>();

  const productsMock = {
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
  };

  const categoryOptionsMock = {
    watchOptions: vi.fn().mockReturnValue({
      valueChanges: categoryValueChangesSubject.asObservable(),
    }),
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
  function setup(data: ProductFormDialogData): void {
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: data });
    fixture = TestBed.createComponent(ProductFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ProductFormDialog, NoopAnimationsModule],
      providers: [
        { provide: Products, useValue: productsMock },
        { provide: CategoryOptions, useValue: categoryOptionsMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: Notification, useValue: notificationMock },
        // Provide a default value; individual tests override it via setup()
        { provide: MAT_DIALOG_DATA, useValue: { product: null } },
      ],
    }).compileComponents();
  });

  // -- Create mode --

  it('renders create form when no product data is passed', () => {
    setup({ product: null });

    expect(component.isEdit()).toBe(false);
    expect(component.title()).toBe('Create product');
    expect(component.form.controls.productName.value).toBe('');
    expect(component.form.controls.unitPrice.value).toBe(0);
    expect(component.form.controls.categoryId.value).toBe('');
  });

  it('marks form invalid when required fields are empty in create mode', () => {
    setup({ product: null });

    // productName is empty (required), categoryId is empty (required),
    // and unitPrice is 0 (min 0.01 fails), so the form is invalid
    expect(component.form.invalid).toBe(true);
  });

  it('marks form invalid when unitPrice is 0', () => {
    setup({ product: null });

    component.form.controls.productName.setValue('Widget');
    component.form.controls.categoryId.setValue('10');
    component.form.controls.unitPrice.setValue(0);

    expect(component.form.controls.unitPrice.hasError('min')).toBe(true);
    expect(component.form.invalid).toBe(true);
  });

  it('does not call createProduct when form is invalid', () => {
    setup({ product: null });

    component.submit();

    expect(productsMock.createProduct).not.toHaveBeenCalled();
  });

  it('calls createProduct with the correct input and closes dialog on success', () => {
    setup({ product: null });

    component.form.controls.productName.setValue('Monitor');
    component.form.controls.unitPrice.setValue(299.99);
    component.form.controls.categoryId.setValue('10');

    productsMock.createProduct.mockReturnValue(
      of({
        data: {
          createProduct: {
            __typename: 'Product',
            id: '99',
            productName: 'Monitor',
            unitPrice: 299.99,
            category: { __typename: 'Category', id: '10', categoryName: 'Electronics' },
          },
        },
      }),
    );

    component.submit();

    expect(productsMock.createProduct).toHaveBeenCalledWith({
      productName: 'Monitor',
      unitPrice: 299.99,
      categoryId: '10',
    });
    expect(notificationMock.success).toHaveBeenCalledWith('Product created successfully.');
    expect(dialogRefMock.close).toHaveBeenCalled();
  });

  // -- Edit mode --

  it('renders edit form with pre-filled values when product data is passed', () => {
    setup({ product: existingProduct });

    expect(component.isEdit()).toBe(true);
    expect(component.title()).toBe('Edit product');
    expect(component.form.controls.productName.value).toBe('Laptop');
    expect(component.form.controls.unitPrice.value).toBe(999.99);
    expect(component.form.controls.categoryId.value).toBe('10');
  });

  it('calls updateProduct with the correct id and input on submit in edit mode', () => {
    setup({ product: existingProduct });

    component.form.controls.productName.setValue('Laptop Pro');
    component.form.controls.unitPrice.setValue(1299.99);
    component.form.controls.categoryId.setValue('10');

    productsMock.updateProduct.mockReturnValue(
      of({
        data: {
          updateProduct: {
            __typename: 'Product',
            id: '5',
            productName: 'Laptop Pro',
            unitPrice: 1299.99,
            category: { __typename: 'Category', id: '10', categoryName: 'Electronics' },
          },
        },
      }),
    );

    component.submit();

    expect(productsMock.updateProduct).toHaveBeenCalledWith('5', {
      productName: 'Laptop Pro',
      unitPrice: 1299.99,
      categoryId: '10',
    });
    expect(notificationMock.success).toHaveBeenCalledWith('Product updated successfully.');
    expect(dialogRefMock.close).toHaveBeenCalled();
  });

  // -- Category options --

  it('populates category options from CategoryOptions.watchOptions()', () => {
    setup({ product: null });

    categoryValueChangesSubject.next({
      data: {
        categories: { content: mockCategories },
      },
    });
    fixture.detectChanges();

    expect(component.categoryOptionsList().length).toBe(2);
    expect(component.categoryOptionsList()[0].categoryName).toBe('Electronics');
  });

  // -- BAD_REQUEST error handling --

  it('shows inline error message and keeps dialog open on BAD_REQUEST', () => {
    setup({ product: null });

    component.form.controls.productName.setValue('Duplicate');
    component.form.controls.unitPrice.setValue(10);
    component.form.controls.categoryId.setValue('10');

    // Use a real CombinedGraphQLErrors so mapError() classifies it as BAD_REQUEST.
    // A plain Error with a manually-attached .errors array does not pass the
    // CombinedGraphQLErrors.is() instanceof check that mapError() relies on.
    const apolloError = makeCombinedError('BAD_REQUEST', 'Product name already exists');

    productsMock.createProduct.mockReturnValue(of({ error: apolloError }));

    component.submit();

    // The dialog must stay open (close() not called)
    expect(dialogRefMock.close).not.toHaveBeenCalled();
    // An inline error message should be set
    expect(component.errorMessage()).not.toBeNull();
  });

  it('calls notification.error and closes dialog on non-BAD_REQUEST error', () => {
    setup({ product: null });

    component.form.controls.productName.setValue('Widget');
    component.form.controls.unitPrice.setValue(10);
    component.form.controls.categoryId.setValue('10');

    const apolloError = makeCombinedError('FORBIDDEN', 'Not allowed');

    productsMock.createProduct.mockReturnValue(of({ error: apolloError }));

    component.submit();

    expect(notificationMock.error).toHaveBeenCalled();
    expect(dialogRefMock.close).toHaveBeenCalled();
  });
});
