import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { Users } from '../../data/users';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type { UserFieldsFragment } from '../../../../core/graphql/generated/graphql';

/**
 * Data passed to UserFormDialog via MAT_DIALOG_DATA.
 *
 * When user is null the dialog is in create mode.
 * When user is provided the dialog is in edit mode.
 */
export interface UserFormDialogData {
  user: UserFieldsFragment | null;
}

/**
 * Typed form for create/update user.
 *
 * Create mode includes a password field; edit mode does not (UpdateUserInput
 * does not accept a password).
 */
interface UserForm {
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  email: FormControl<string>;
  password: FormControl<string>;
}

/**
 * Create/edit user dialog.
 *
 * Opened from UserListPage with UserFormDialogData. In create mode all four
 * fields are shown; in edit mode the password field is hidden because
 * UpdateUserInput only accepts firstName, lastName, and email.
 *
 * On success the dialog closes with the saved User. The caller (UserListPage)
 * can use this to refetch the list. On BAD_REQUEST the dialog stays open and
 * shows the backend message inline.
 */
@Component({
  selector: 'app-user-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './user-form.dialog.html',
  styleUrl: './user-form.dialog.scss',
})
export class UserFormDialog {
  // inject() replaces constructor injection in Angular 21
  readonly data = inject<UserFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<UserFormDialog>);
  private readonly usersService = inject(Users);
  private readonly notification = inject(Notification);

  /** True when editing an existing user; false when creating a new one. */
  readonly isEdit = computed(() => this.data.user !== null);
  readonly title = computed(() => (this.isEdit() ? 'Edit user' : 'Create user'));

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup<UserForm>({
    firstName: new FormControl(this.data.user?.firstName ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    lastName: new FormControl(this.data.user?.lastName ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    email: new FormControl(this.data.user?.email ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    // Password is required only in create mode; edit mode hides this field
    password: new FormControl('', {
      nonNullable: true,
      validators: this.data.user ? [] : [Validators.required, Validators.minLength(8)],
    }),
  });

  get firstNameControl(): AbstractControl { return this.form.controls.firstName; }
  get lastNameControl(): AbstractControl { return this.form.controls.lastName; }
  get emailControl(): AbstractControl { return this.form.controls.email; }
  get passwordControl(): AbstractControl { return this.form.controls.password; }

  /**
   * Submits the form.
   *
   * In create mode calls createUser; in edit mode calls updateUser. On success
   * closes with the saved user. On BAD_REQUEST shows the backend message inline
   * and keeps the dialog open so the user can correct and resubmit.
   */
  submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);

    const { firstName, lastName, email, password } = this.form.getRawValue();
    const userId = this.data.user?.id;

    const mutation$ = userId
      ? this.usersService.updateUser(userId, { firstName, lastName, email })
      : this.usersService.createUser({ firstName, lastName, email, password });

    mutation$.subscribe({
      next: (result) => {
        this.loading.set(false);
        if (result.errors?.length) {
          const appError = mapError(result.errors[0] as unknown as Error);
          this.errorMessage.set(appError.message);
          return;
        }
        const savedUser = userId
          ? (result.data as { updateUser: UserFieldsFragment }).updateUser
          : (result.data as { createUser: UserFieldsFragment }).createUser;
        this.notification.success(`User ${userId ? 'updated' : 'created'} successfully.`);
        this.dialogRef.close(savedUser);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('An unexpected error occurred. Please try again.');
      },
    });
  }
}
