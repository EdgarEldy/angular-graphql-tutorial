import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthFeature } from '../../data/auth-feature';
import { mapError } from '../../../../core/graphql/error-mapper';

/**
 * Typed form shape for the reset-password form.
 */
interface ResetPasswordForm {
  newPassword: FormControl<string>;
  confirmPassword: FormControl<string>;
}

/**
 * Custom validator that checks whether the two password controls match.
 *
 * Applied at the FormGroup level (not per-control) so it can compare both
 * values. Returns { passwordMismatch: true } when they differ, or null when
 * they match. The template reads this error on the group, not on a single field.
 */
const passwordsMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const newPw = group.get('newPassword')?.value as string;
  const confirmPw = group.get('confirmPassword')?.value as string;
  // Return null (valid) when either field is still empty -- the required validator handles those
  if (!newPw || !confirmPw) return null;
  return newPw === confirmPw ? null : { passwordMismatch: true };
};

/**
 * Reset-password page (public route: /reset-password?token=...).
 *
 * Reads the token from the query string and submits it together with the
 * new password. A client-side match check (passwordsMatchValidator) ensures
 * both fields are equal before the network call. On a BAD_REQUEST (invalid or
 * expired token) the backend message is shown inline so the user can request
 * a fresh token without leaving the page.
 */
@Component({
  selector: 'app-reset-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './reset-password-page.page.html',
  styleUrl: './reset-password-page.page.scss',
})
export class ResetPasswordPagePage {
  // inject() replaces constructor injection in Angular 21
  private readonly route = inject(ActivatedRoute);
  private readonly authFeature = inject(AuthFeature);

  readonly loading = signal(false);
  readonly success = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Typed reactive form with a group-level validator to enforce password match.
   *
   * Using a group-level validator (rather than two per-field validators) is the
   * standard approach for cross-field validation in Angular reactive forms.
   */
  readonly form = new FormGroup<ResetPasswordForm>(
    {
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [passwordsMatchValidator] },
  );

  get newPasswordControl(): AbstractControl { return this.form.controls.newPassword; }
  get confirmPasswordControl(): AbstractControl { return this.form.controls.confirmPassword; }

  /**
   * Whether the group-level passwordMismatch error is currently active.
   * Exposed as a getter so the template reads cleanly without nested optional chaining.
   */
  get passwordMismatch(): boolean {
    return this.form.hasError('passwordMismatch');
  }

  /**
   * Reads the token from the query string, validates the form client-side,
   * then calls resetPassword. BAD_REQUEST (invalid/expired token) is shown
   * inline so the user can request a new reset link.
   */
  submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.errorMessage.set('No reset token found in the URL. Please request a new password reset link.');
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);

    const { newPassword } = this.form.getRawValue();
    this.authFeature.resetPassword(token, newPassword).subscribe({
      next: (result) => {
        this.loading.set(false);
        // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
        if (result.error) {
          const appError = mapError(result.error as Error);
          this.errorMessage.set(appError.message);
          return;
        }
        this.success.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('An unexpected error occurred. Please try again.');
      },
    });
  }
}
