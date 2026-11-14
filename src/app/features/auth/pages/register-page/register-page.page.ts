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
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthFeature } from '../../data/auth-feature';
import { mapError } from '../../../../core/graphql/error-mapper';

/**
 * Typed form shape for registration.
 */
interface RegisterForm {
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  email: FormControl<string>;
  password: FormControl<string>;
  confirmPassword: FormControl<string>;
}

/**
 * Cross-field validator that checks confirmPassword matches password.
 *
 * Attached to the FormGroup (not to a single control) so it can read both
 * sibling control values. Returns `{ passwordMismatch: true }` when the
 * passwords differ; null when they match or when password is empty (the
 * individual Validators.required on password already covers the empty case).
 *
 * @returns A ValidatorFn that operates on a FormGroup control.
 */
function passwordsMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value as string;
    const confirm = group.get('confirmPassword')?.value as string;
    if (!password || !confirm) return null;
    return password === confirm ? null : { passwordMismatch: true };
  };
}

/**
 * Registration page (public route: /register).
 *
 * On success it does NOT log the user in automatically. Per the API contract,
 * the account is disabled until activateAccount is called with the token sent
 * to the user's email. The page shows an activation-required message instead
 * of navigating to the app.
 *
 * BAD_REQUEST errors (email already taken, validation failures) are shown
 * inline below the form so the user can correct and resubmit.
 */
@Component({
  selector: 'app-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './register-page.page.html',
  styleUrl: './register-page.page.scss',
})
export class RegisterPagePage {
  // inject() replaces constructor injection in Angular 21
  private readonly authFeature = inject(AuthFeature);

  readonly loading = signal(false);

  /** Controls whether the password field renders as text (true) or password (false). */
  readonly showPassword = signal(false);

  /**
   * When the registration succeeds the page switches to a success message.
   * Storing a boolean signal avoids a router navigation that would lose context.
   */
  readonly registered = signal(false);

  /**
   * Holds the backend error message when registration fails.
   */
  readonly errorMessage = signal<string | null>(null);

  /**
   * Typed reactive form for registration.
   *
   * Password length (min 8) is a UX hint only: the backend is the authority
   * on the actual password policy. The frontend check prevents obviously bad
   * inputs before the network round-trip.
   *
   * The group-level `passwordsMatchValidator` checks that confirmPassword
   * equals password. Business rule 8 in the API contract requires this client-
   * side check before sending the request to the backend.
   */
  readonly form = new FormGroup<RegisterForm>(
    {
      firstName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      lastName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl('', {
        nonNullable: true,
        // minLength(8) is a UX hint -- the backend enforces its own policy
        validators: [Validators.required, Validators.minLength(8)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    // Group-level validator runs after all individual controls are valid.
    { validators: passwordsMatchValidator() },
  );

  get firstNameControl(): AbstractControl { return this.form.controls.firstName; }
  get lastNameControl(): AbstractControl { return this.form.controls.lastName; }
  get emailControl(): AbstractControl { return this.form.controls.email; }
  get passwordControl(): AbstractControl { return this.form.controls.password; }
  get confirmPasswordControl(): AbstractControl { return this.form.controls.confirmPassword; }

  /**
   * Submits the registration form.
   *
   * On success: switches to the activation-required message (registered = true).
   * On BAD_REQUEST: shows the backend message inline and keeps the form open.
   *
   * @see AuthFeature.register
   */
  submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authFeature.register(this.form.getRawValue()).subscribe({
      next: (result) => {
        this.loading.set(false);
        // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
        if (result.error) {
          const appError = mapError(result.error as Error);
          this.errorMessage.set(appError.message);
          return;
        }
        // Account is disabled until activated; do NOT auto-login
        this.registered.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('An unexpected error occurred. Please try again.');
      },
    });
  }
}
