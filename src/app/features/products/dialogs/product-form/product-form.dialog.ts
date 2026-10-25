import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { Products } from '../../data/products';
import { CategoryOptions } from '../../../categories/data/category-options';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type {
  GetCategoryOptionsQuery,
  ProductFieldsFragment,
} from '../../../../core/graphql/generated/graphql';

/**
 * Data passed to ProductFormDialog via MAT_DIALOG_DATA.
 *
 * When product is null the dialog is in create mode and calls createProduct.
 * When product is provided the dialog is in edit mode and calls updateProduct.
 */
export interface ProductFormDialogData {
  product: ProductFieldsFragment | null;
}

/**
 * Typed form for create/update product.
 *
 * Matches the ProductInput shape on the backend: productName (string),
 * unitPrice (number), categoryId (string). All three are required; unitPrice
 * must be greater than 0.
 */
interface ProductForm {
  productName: FormControl<string>;
  unitPrice: FormControl<number>;
  categoryId: FormControl<string>;
}

/**
 * Create/edit product dialog.
 *
 * Opened from ProductListPage with ProductFormDialogData. In create mode the
 * form is empty; in edit mode it is pre-filled from the list row's cached data.
 * The category select is populated from CategoryOptions.watchOptions() which
 * reuses the Apollo InMemoryCache entry, avoiding a redundant network request
 * if the category list has already been fetched.
 *
 * On success the dialog closes with the saved Product. On BAD_REQUEST the
 * dialog stays open and shows the backend message inline so the user can
 * correct the input.
 */
@Component({
  selector: 'app-product-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './product-form.dialog.html',
  styleUrl: './product-form.dialog.scss',
})
export class ProductFormDialog implements OnInit {
  // inject() replaces constructor injection in Angular 21
  readonly data = inject<ProductFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ProductFormDialog>);
  private readonly productsService = inject(Products);
  private readonly categoryOptions = inject(CategoryOptions);
  private readonly notification = inject(Notification);
  private readonly destroyRef = inject(DestroyRef);

  /** True when editing an existing product; false when creating a new one. */
  readonly isEdit = computed(() => this.data.product !== null);

  /**
   * The dialog title displayed in the mat-dialog-title heading.
   *
   * Shows "Edit product" when a product was passed in (edit mode) and
   * "Create product" when the dialog was opened without a product (create mode).
   *
   * @returns The dialog heading string.
   */
  readonly title = computed(() => (this.isEdit() ? 'Edit product' : 'Create product'));

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Category options for the category select.
   *
   * Populated from CategoryOptions.watchOptions() in ngOnInit. Using a signal
   * means the template re-renders automatically when the options arrive from
   * the network or are read from the Apollo cache.
   */
  readonly categoryOptionsList = signal<GetCategoryOptionsQuery['categories']['content']>([]);

  readonly form = new FormGroup<ProductForm>({
    // nonNullable:true ensures getRawValue() returns string, not string | null.
    productName: new FormControl(this.data.product?.productName ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    unitPrice: new FormControl(this.data.product?.unitPrice ?? 0, {
      nonNullable: true,
      // min(0.01) enforces the "greater than 0" business rule on the client side
      validators: [Validators.required, Validators.min(0.01)],
    }),
    categoryId: new FormControl(this.data.product?.category.id ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  /**
   * Getter used in the template to access the productName control.
   *
   * Returning AbstractControl (not FormControl<string>) keeps the template
   * decoupled from the generic type parameter and avoids a lint warning.
   */
  get productNameControl(): AbstractControl {
    return this.form.controls.productName;
  }

  /**
   * Getter used in the template to access the unitPrice control.
   *
   * @returns The unitPrice AbstractControl.
   */
  get unitPriceControl(): AbstractControl {
    return this.form.controls.unitPrice;
  }

  /**
   * Getter used in the template to access the categoryId control.
   *
   * @returns The categoryId AbstractControl.
   */
  get categoryIdControl(): AbstractControl {
    return this.form.controls.categoryId;
  }

  /**
   * Subscribes to the category options query on init.
   *
   * takeUntilDestroyed(destroyRef) is required here because we are outside the
   * constructor injection context and the observable must be cleaned up when
   * the dialog is destroyed.
   */
  ngOnInit(): void {
    this.categoryOptions
      .watchOptions()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (result.data?.categories?.content) {
            // With errorPolicy:'all', Apollo v4 types data as MaybeDeepPartial.
            // At this point there are no errors so data is complete; assert the full type.
            this.categoryOptionsList.set(
              result.data.categories.content as GetCategoryOptionsQuery['categories']['content'],
            );
          }
        },
      });
  }

  /**
   * Submits the create or update mutation.
   *
   * In create mode calls createProduct and closes with the returned product.
   * In edit mode calls updateProduct; Apollo normalises the result into the
   * cache so the list page row updates automatically without a refetch.
   *
   * On BAD_REQUEST the dialog stays open and displays the backend message so
   * the user can correct the input and resubmit. On any other error a generic
   * snackbar is shown and the dialog closes.
   */
  submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);

    const { productName, unitPrice, categoryId } = this.form.getRawValue();
    const productId = this.data.product?.id;

    // Separate branches required because the TypeScript union of two Observable types
    // does not have a usable subscribe() overload; each branch gets a concrete type.
    if (productId) {
      this.productsService.updateProduct(productId, { productName, unitPrice, categoryId }).subscribe({
        next: (result) => {
          this.loading.set(false);
          // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
          if (result.error) {
            this.handleMutationError(result.error as Error);
            return;
          }
          const savedProduct = result.data?.updateProduct;
          if (savedProduct) {
            this.notification.success('Product updated successfully.');
            this.dialogRef.close(savedProduct);
          }
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set('An unexpected error occurred. Please try again.');
        },
      });
    } else {
      this.productsService.createProduct({ productName, unitPrice, categoryId }).subscribe({
        next: (result) => {
          this.loading.set(false);
          // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
          if (result.error) {
            this.handleMutationError(result.error as Error);
            return;
          }
          const savedProduct = result.data?.createProduct;
          if (savedProduct) {
            this.notification.success('Product created successfully.');
            this.dialogRef.close(savedProduct);
          }
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set('An unexpected error occurred. Please try again.');
        },
      });
    }
  }

  /**
   * Dispatches a mapped Apollo error to the correct UI surface.
   *
   * Only BAD_REQUEST keeps the dialog open with an inline message so the user
   * can correct the input and resubmit. All other kinds (FORBIDDEN,
   * INTERNAL_ERROR, NETWORK, NOT_FOUND, UNAUTHENTICATED) are surfaced as
   * snackbar notifications and the dialog is closed, because they represent
   * conditions the user cannot fix by editing the form.
   *
   * @param rawError - The raw error from the Apollo mutation result.
   */
  private handleMutationError(rawError: Error): void {
    const appError = mapError(rawError);
    if (appError.kind === 'BAD_REQUEST') {
      // BAD_REQUEST is a business or validation message the user can act on:
      // keep the dialog open so they can correct and resubmit.
      this.errorMessage.set(appError.message);
    } else {
      // Any other kind (FORBIDDEN, INTERNAL_ERROR, NETWORK, etc.) cannot be
      // resolved by editing the form; surface it as a snackbar and close.
      this.notification.error(appError.message);
      this.dialogRef.close();
    }
  }
}
