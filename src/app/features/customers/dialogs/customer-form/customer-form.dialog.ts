import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Customers } from '../../data/customers';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type { CustomerFieldsFragment } from '../../../../core/graphql/generated/graphql';

/**
 * Data passed to CustomerFormDialog via MAT_DIALOG_DATA.
 *
 * When customer is null the dialog is in create mode and calls createCustomer.
 * When customer is provided the dialog is in edit mode and calls updateCustomer.
 */
export interface CustomerFormDialogData {
  customer: CustomerFieldsFragment | null;
}

/**
 * Typed form for create/update customer.
 *
 * Matches the CustomerInput shape on the backend: firstName, lastName,
 * telephone, email, address. All five fields are required; email must be
 * a valid email address (Validators.email).
 */
interface CustomerForm {
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  telephone: FormControl<string>;
  email: FormControl<string>;
  address: FormControl<string>;
}

/**
 * Create/edit customer dialog.
 *
 * Opened from CustomerListPage with CustomerFormDialogData. In create mode
 * the form is empty; in edit mode it is pre-filled from the list row's cached
 * data, avoiding an extra round trip to fetch the entity.
 *
 * On success the dialog closes with the saved Customer and the list page
 * either refetches (create) or benefits from cache normalisation (update).
 * On BAD_REQUEST the dialog stays open and shows the backend message inline
 * so the user can correct the input.
 */
@Component({
  selector: 'app-customer-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './customer-form.dialog.html',
  styleUrl: './customer-form.dialog.scss',
})
export class CustomerFormDialog {
  // inject() replaces constructor injection in Angular 21
  readonly data = inject<CustomerFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CustomerFormDialog>);
  private readonly customersService = inject(Customers);
  private readonly notification = inject(Notification);
  // DestroyRef is not used here because we subscribe to a single Observable
  // that completes on the first emission (the mutation result), so no
  // takeUntilDestroyed cleanup is needed.
  private readonly _destroyRef = inject(DestroyRef);

  /** True when editing an existing customer; false when creating a new one. */
  readonly isEdit = computed(() => this.data.customer !== null);

  /**
   * The dialog title displayed in the mat-dialog-title heading.
   *
   * Shows "Edit customer" when a customer was passed in (edit mode) and
   * "Create customer" when the dialog was opened without a customer.
   *
   * @returns The dialog heading string.
   */
  readonly title = computed(() => (this.isEdit() ? 'Edit customer' : 'Create customer'));

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup<CustomerForm>({
    // nonNullable:true ensures getRawValue() returns string, not string | null.
    firstName: new FormControl(this.data.customer?.firstName ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    lastName: new FormControl(this.data.customer?.lastName ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    telephone: new FormControl(this.data.customer?.telephone ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    email: new FormControl(this.data.customer?.email ?? '', {
      nonNullable: true,
      // Validators.email uses the HTML5 email regex; it is a client-side hint
      // only -- the backend validates as the authority.
      validators: [Validators.required, Validators.email],
    }),
    address: new FormControl(this.data.customer?.address ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  /**
   * Getter used in the template to access the firstName control.
   *
   * Returning AbstractControl (not FormControl<string>) keeps the template
   * decoupled from the generic type parameter and avoids a lint warning.
   *
   * @returns The firstName AbstractControl.
   */
  get firstNameControl(): AbstractControl {
    return this.form.controls.firstName;
  }

  /**
   * Getter used in the template to access the lastName control.
   *
   * @returns The lastName AbstractControl.
   */
  get lastNameControl(): AbstractControl {
    return this.form.controls.lastName;
  }

  /**
   * Getter used in the template to access the telephone control.
   *
   * @returns The telephone AbstractControl.
   */
  get telephoneControl(): AbstractControl {
    return this.form.controls.telephone;
  }

  /**
   * Getter used in the template to access the email control.
   *
   * @returns The email AbstractControl.
   */
  get emailControl(): AbstractControl {
    return this.form.controls.email;
  }

  /**
   * Getter used in the template to access the address control.
   *
   * @returns The address AbstractControl.
   */
  get addressControl(): AbstractControl {
    return this.form.controls.address;
  }

  /**
   * Submits the create or update mutation.
   *
   * In create mode calls createCustomer and closes with the returned customer.
   * In edit mode calls updateCustomer; Apollo normalises the result into the
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

    const { firstName, lastName, telephone, email, address } = this.form.getRawValue();
    const customerId = this.data.customer?.id;

    // Separate branches required because the TypeScript union of two Observable types
    // does not have a usable subscribe() overload; each branch gets a concrete type.
    if (customerId) {
      this.customersService
        .updateCustomer(customerId, { firstName, lastName, telephone, email, address })
        .subscribe({
          next: (result) => {
            this.loading.set(false);
            // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
            if (result.error) {
              this.handleMutationError(result.error as Error);
              return;
            }
            const savedCustomer = result.data?.updateCustomer;
            if (savedCustomer) {
              this.notification.success('Customer updated successfully.');
              this.dialogRef.close(savedCustomer);
            }
          },
          error: () => {
            this.loading.set(false);
            this.errorMessage.set('An unexpected error occurred. Please try again.');
          },
        });
    } else {
      this.customersService
        .createCustomer({ firstName, lastName, telephone, email, address })
        .subscribe({
          next: (result) => {
            this.loading.set(false);
            // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
            if (result.error) {
              this.handleMutationError(result.error as Error);
              return;
            }
            const savedCustomer = result.data?.createCustomer;
            if (savedCustomer) {
              this.notification.success('Customer created successfully.');
              this.dialogRef.close(savedCustomer);
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
