import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Orders } from '../../data/orders';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type {
  GetCustomerOptionsQuery,
  GetProductOptionsQuery,
  OrderFieldsFragment,
} from '../../../../core/graphql/generated/graphql';

/**
 * The value returned by OrderFormDialog when the dialog closes successfully.
 *
 * The caller receives the full OrderFieldsFragment so it can prepend the
 * server's total (not the client estimate) to the list immediately.
 */
export type OrderFormDialogResult = OrderFieldsFragment;

/**
 * Typed form for creating an order.
 *
 * Matches the OrderInput shape: customerId (string), productId (string),
 * quantity (number >= 1). There is no edit mode because the backend does not
 * expose updateOrder.
 */
interface OrderForm {
  customerId: FormControl<string>;
  productId: FormControl<string>;
  quantity: FormControl<number>;
}

/**
 * Create order dialog.
 *
 * Presents a customer select, a product select, and a quantity input. As the
 * user fills the form, the dialog computes and displays a client-side estimated
 * total (quantity * selectedProduct.unitPrice) clearly labelled as an estimate.
 * After the mutation succeeds, the caller receives the server's computed total
 * via the returned OrderFieldsFragment.
 *
 * On BAD_REQUEST the dialog stays open with an inline error so the user can
 * correct and resubmit. On any other error a snackbar is shown and the dialog
 * closes.
 */
@Component({
  selector: 'app-order-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
  ],
  templateUrl: './order-form.dialog.html',
  styleUrl: './order-form.dialog.scss',
})
export class OrderFormDialog implements OnInit {
  // inject() replaces constructor injection in Angular 21
  private readonly dialogRef = inject(MatDialogRef<OrderFormDialog>);
  private readonly ordersService = inject(Orders);
  private readonly notification = inject(Notification);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Customer options for the customer select.
   *
   * Populated from ordersService.watchCustomerOptions() in ngOnInit.
   */
  readonly customerOptions = signal<GetCustomerOptionsQuery['customers']['content']>([]);

  /**
   * Product options for the product select.
   *
   * Populated from ordersService.watchProductOptions() in ngOnInit. Includes
   * unitPrice so the estimated total can be computed client-side.
   */
  readonly productOptions = signal<GetProductOptionsQuery['products']['content']>([]);

  /**
   * The unit price of the currently selected product.
   *
   * Updated in ngOnInit whenever the productId control value changes.
   * Used as one operand of estimatedTotal.
   */
  readonly selectedUnitPrice = signal(0);

  /**
   * The current quantity entered by the user, mirrored as a signal.
   *
   * Angular's reactive form controls are plain objects -- computed() only tracks
   * signal reads, not plain property accesses. Mirroring the form value into a
   * signal is therefore necessary to make estimatedTotal react to quantity changes.
   * Updated in ngOnInit whenever the quantity control value changes.
   */
  readonly currentQuantity = signal(1);

  /**
   * Client-side estimated total: currentQuantity * selectedUnitPrice.
   *
   * computed() re-evaluates automatically when either signal changes. This value
   * is displayed in the template clearly labelled as an "estimate" because the
   * authoritative total is computed server-side after the mutation. For example,
   * discounts or currency rounding rules could cause the server's total to differ
   * from this simple multiplication.
   */
  readonly estimatedTotal = computed(() => this.currentQuantity() * this.selectedUnitPrice());

  readonly form = new FormGroup<OrderForm>({
    // nonNullable:true ensures getRawValue() returns string, not string | null.
    customerId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    productId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    quantity: new FormControl(1, {
      nonNullable: true,
      // min(1) enforces the "quantity >= 1" business rule on the client side
      validators: [Validators.required, Validators.min(1)],
    }),
  });

  /**
   * Getter used in the template to access the customerId control.
   *
   * Returning AbstractControl (not FormControl<string>) keeps the template
   * decoupled from the generic type parameter and avoids lint warnings.
   *
   * @returns The customerId AbstractControl.
   */
  get customerIdControl(): AbstractControl {
    return this.form.controls.customerId;
  }

  /**
   * Getter used in the template to access the productId control.
   *
   * @returns The productId AbstractControl.
   */
  get productIdControl(): AbstractControl {
    return this.form.controls.productId;
  }

  /**
   * Getter used in the template to access the quantity control.
   *
   * @returns The quantity AbstractControl.
   */
  get quantityControl(): AbstractControl {
    return this.form.controls.quantity;
  }

  /**
   * Subscribes to the customer and product option queries, and watches form
   * value changes to keep the estimated total in sync.
   *
   * takeUntilDestroyed(destroyRef) is required here because we are outside the
   * constructor injection context and the observables must be cleaned up when
   * the dialog is destroyed.
   */
  ngOnInit(): void {
    // Load customer options for the select
    this.ordersService
      .watchCustomerOptions()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (result.data?.customers?.content) {
            // With errorPolicy:'all', Apollo v4 types data as MaybeDeepPartial.
            // At this point there are no errors so data is complete; assert the full type.
            this.customerOptions.set(
              result.data.customers.content as GetCustomerOptionsQuery['customers']['content'],
            );
          }
        },
      });

    // Load product options for the select (includes unitPrice for the estimate)
    this.ordersService
      .watchProductOptions()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (result.data?.products?.content) {
            this.productOptions.set(
              result.data.products.content as GetProductOptionsQuery['products']['content'],
            );
          }
        },
      });

    // Mirror productId form control changes into selectedUnitPrice signal.
    // This allows estimatedTotal (a computed) to track product selection reactively.
    this.form.controls.productId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productId) => {
        const product = this.productOptions().find((p) => p.id === productId);
        this.selectedUnitPrice.set(product?.unitPrice ?? 0);
      });

    // Mirror quantity form control changes into currentQuantity signal.
    // computed() can only track signals; the form control value is a plain number.
    this.form.controls.quantity.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((qty) => {
        this.currentQuantity.set(qty);
      });
  }

  /**
   * Submits the createOrder mutation.
   *
   * On success the dialog closes with the saved Order (full OrderFieldsFragment)
   * so the list page can display the server's authoritative total. On BAD_REQUEST
   * the dialog stays open with an inline message. On any other error a snackbar
   * is shown and the dialog closes.
   */
  submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);

    const { customerId, productId, quantity } = this.form.getRawValue();

    this.ordersService.createOrder({ customerId, productId, quantity }).subscribe({
      next: (result) => {
        this.loading.set(false);
        // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
        if (result.error) {
          this.handleMutationError(result.error as Error);
          return;
        }
        const savedOrder = result.data?.createOrder;
        if (savedOrder) {
          this.notification.success(`Order #${savedOrder.id} created.`);
          this.dialogRef.close(savedOrder as OrderFormDialogResult);
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('An unexpected error occurred. Please try again.');
      },
    });
  }

  /**
   * Dispatches a mapped Apollo error to the correct UI surface.
   *
   * Only BAD_REQUEST keeps the dialog open so the user can correct the input.
   * All other kinds are surfaced as snackbar notifications and the dialog closes.
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
      // Any other kind cannot be resolved by editing the form; close the dialog.
      this.notification.error(appError.message);
      this.dialogRef.close();
    }
  }
}
