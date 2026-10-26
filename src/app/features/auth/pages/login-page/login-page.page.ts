import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../core/auth/auth.service';
import { mapError } from '../../../../core/graphql/error-mapper';

/**
 * Typed form shape for login.
 *
 * Using a typed FormGroup ensures that form.value is fully typed and that
 * adding/renaming a field causes a compile error at every access site.
 */
interface LoginForm {
  email: FormControl<string>;
  password: FormControl<string>;
}

/**
 * Login page (public route: /login).
 *
 * Smart component: it owns the reactive form, calls AuthService.login(), and
 * navigates on success. Display concerns (button label, spinner) live here
 * because they are tightly coupled to the mutation lifecycle.
 *
 * Return-URL handling: after a forced redirect to /login the router writes the
 * original URL into the query parameter `returnUrl`. On success the user is sent
 * back to that URL (defaulting to '/') so they land where they intended.
 */
@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './login-page.page.html',
  styleUrl: './login-page.page.scss',
})
export class LoginPagePage {
  // inject() replaces constructor injection in Angular 21
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /**
   * Tracks whether the login mutation is in flight.
   * Disables the submit button and shows a spinner to prevent double-submits.
   */
  readonly loading = signal(false);

  /**
   * Holds the backend error message when login fails (e.g. bad credentials).
   * Displayed inline below the form so the user can correct and resubmit.
   */
  readonly errorMessage = signal<string | null>(null);

  /**
   * Typed reactive form with email and password controls.
   *
   * FormGroup<LoginForm> is the Angular 14+ typed form API: form.value.email is
   * string, not string | null | undefined, so no type assertions are needed.
   */
  readonly form = new FormGroup<LoginForm>({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  /** Convenience accessor -- keeps templates short without repeated form.controls lookups. */
  get emailControl(): AbstractControl {
    return this.form.controls.email;
  }

  /** @see emailControl */
  get passwordControl(): AbstractControl {
    return this.form.controls.password;
  }

  /**
   * Submits the login form.
   *
   * The pattern here is: mark loading true -> call service -> on success navigate
   * to the return URL -> on error show the backend message inline. This mirrors
   * the pattern used by every other form mutation in the application.
   *
   * The return URL is read from the router's query params rather than stored in
   * a service so it survives page reloads and deep links.
   */
  submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.form.getRawValue();
    this.authService.login({ email, password }).subscribe({
      next: (result) => {
        this.loading.set(false);
        // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
        if (result.error) {
          const appError = mapError(result.error as Error);
          this.errorMessage.set(appError.message);
          return;
        }
        // Return to the URL the user was trying to reach before the redirect
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
        void this.router.navigateByUrl(returnUrl);
      },
      error: () => {
        // The global error link handles UNAUTHENTICATED; this catches unexpected failures
        this.loading.set(false);
        this.errorMessage.set('An unexpected error occurred. Please try again.');
      },
    });
  }
}
