import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthFeature } from '../../data/auth-feature';

/**
 * Typed form shape for the forgot-password form.
 */
interface ForgotPasswordForm {
  email: FormControl<string>;
}

/**
 * Forgot-password page (public route: /forgot-password).
 *
 * Per the API contract, requestPasswordReset always returns true regardless
 * of whether the email exists. The UI must therefore always show the same
 * neutral confirmation to avoid leaking which email addresses are registered.
 *
 * This means the component shows the same success message whether the email
 * is in the database or not, and never surfaces a backend error about the
 * email not existing.
 */
@Component({
  selector: 'app-forgot-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './forgot-password-page.page.html',
  styleUrl: './forgot-password-page.page.scss',
})
export class ForgotPasswordPagePage {
  // inject() replaces constructor injection in Angular 21
  private readonly authFeature = inject(AuthFeature);

  readonly loading = signal(false);

  /**
   * After submit (regardless of backend result), the form is replaced by a
   * neutral confirmation message that does not reveal whether the email exists.
   */
  readonly submitted = signal(false);

  readonly form = new FormGroup<ForgotPasswordForm>({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  get emailControl(): AbstractControl { return this.form.controls.email; }

  /**
   * Calls requestPasswordReset and always transitions to the submitted state.
   *
   * Even if the backend returns an error (network failure, etc.) the page shows
   * the same neutral message, because revealing a failure would let an attacker
   * enumerate valid email addresses. A network failure is intentionally swallowed.
   */
  submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }
    this.loading.set(true);
    const { email } = this.form.getRawValue();

    this.authFeature.requestPasswordReset(email).subscribe({
      // Always show the neutral confirmation -- never reveal whether the email exists
      next: () => {
        this.loading.set(false);
        this.submitted.set(true);
      },
      error: () => {
        // Intentionally swallow the error for email enumeration protection
        this.loading.set(false);
        this.submitted.set(true);
      },
    });
  }
}
