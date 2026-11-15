import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthFeature } from '../../data/auth-feature';
import { AuthService, SessionUser } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/notification/notification.service';
import { mapError } from '../../../../core/graphql/error-mapper';

/** Shape of the data passed to this dialog from ProfilePagePage. */
export interface UpdateProfileDialogData {
  firstName: string;
  lastName: string;
  email: string;
}

/** Typed form group for profile editing. */
interface UpdateProfileForm {
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  email: FormControl<string>;
}

/**
 * Dialog for editing the authenticated user's first name, last name and email.
 *
 * All three fields are optional in UpdateProfileInput: the backend accepts a
 * partial update and only changes the fields that are present. The form
 * pre-fills the current values so the user sees what they are editing.
 *
 * On success the dialog closes with the updated SessionUser so the profile
 * page can synchronise the in-memory session via AuthService.updateSessionUser
 * without an extra me round-trip.
 *
 * On BAD_REQUEST the dialog stays open and the backend message is shown inline.
 * On UNAUTHENTICATED the dialog closes and the user is redirected to /auth/login.
 */
@Component({
  selector: 'app-update-profile-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './update-profile.dialog.html',
  styleUrl: './update-profile.dialog.scss',
})
export class UpdateProfileDialog {
  private readonly authFeature = inject(AuthFeature);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);
  private readonly dialogRef = inject(MatDialogRef<UpdateProfileDialog>);
  protected readonly data = inject<UpdateProfileDialogData>(MAT_DIALOG_DATA);

  readonly loading = signal(false);
  readonly serverError = signal<string | null>(null);

  /**
   * Pre-filled with the current user's values.
   * Validators.email is a UX hint; the backend enforces the real policy.
   */
  readonly form = new FormGroup<UpdateProfileForm>({
    firstName: new FormControl(this.data.firstName, { nonNullable: true }),
    lastName: new FormControl(this.data.lastName, { nonNullable: true }),
    email: new FormControl(this.data.email, {
      nonNullable: true,
      validators: [Validators.email],
    }),
  });

  get firstNameControl(): AbstractControl { return this.form.controls.firstName; }
  get lastNameControl(): AbstractControl { return this.form.controls.lastName; }
  get emailControl(): AbstractControl { return this.form.controls.email; }

  /**
   * Submits the profile update mutation.
   *
   * Only non-empty fields are sent in the input so a user can update just
   * one field without accidentally clearing the others. On success the dialog
   * closes with the updated SessionUser so the caller can apply it via
   * AuthService.updateSessionUser without an extra network round-trip.
   *
   * @see AuthFeature.updateProfile
   */
  submit(): void {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.serverError.set(null);

    // Build a partial input: omit fields whose value did not change or is empty.
    const { firstName, lastName, email } = this.form.getRawValue();
    const input: { firstName?: string; lastName?: string; email?: string } = {};
    if (firstName) input.firstName = firstName;
    if (lastName) input.lastName = lastName;
    if (email) input.email = email;

    this.authFeature.updateProfile(input).subscribe({
      next: (result) => {
        this.loading.set(false);
        if (result.error) {
          const appError = mapError(result.error as Error);

          if (appError.kind === 'UNAUTHENTICATED') {
            this.dialogRef.close();
            void this.router.navigate(['/auth/login'], {
              queryParams: { returnUrl: '/profile' },
            });
            return;
          }

          if (appError.kind === 'FORBIDDEN') {
            this.notification.error(appError.message);
            return;
          }

          this.serverError.set(appError.message);
          return;
        }

        const updated = result.data?.updateProfile;
        if (updated) {
          // Cast is safe: UpdateProfileMutation returns the same User shape as SessionUser.
          this.dialogRef.close(updated as SessionUser);
        }
      },
      error: () => {
        this.loading.set(false);
        this.serverError.set('An unexpected error occurred. Please try again.');
      },
    });
  }
}
