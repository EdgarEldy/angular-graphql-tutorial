import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
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
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './register-page.page.html',
  styleUrl: './register-page.page.scss',
})
export class RegisterPagePage {
  // inject() replaces constructor injection in Angular 21
  private readonly authFeature = inject(AuthFeature);

  readonly loading = signal(false);

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
   */
  readonly form = new FormGroup<RegisterForm>({
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
  });

  get firstNameControl(): AbstractControl { return this.form.controls.firstName; }
  get lastNameControl(): AbstractControl { return this.form.controls.lastName; }
  get emailControl(): AbstractControl { return this.form.controls.email; }
  get passwordControl(): AbstractControl { return this.form.controls.password; }

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
        if (result.errors?.length) {
          const appError = mapError(result.errors[0] as unknown as Error);
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
