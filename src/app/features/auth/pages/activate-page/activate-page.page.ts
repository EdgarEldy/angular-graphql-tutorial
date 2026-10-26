import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthFeature } from '../../data/auth-feature';
import { mapError } from '../../../../core/graphql/error-mapper';

/** Possible states the activation page can be in. */
type ActivationState = 'loading' | 'success' | 'error';

/**
 * Account activation page (public route: /activate?token=...).
 *
 * Reads the token from the URL query string and immediately calls the
 * activateAccount mutation on init. There is no form to fill in: the entire
 * interaction is automatic. The page shows a loading spinner, then either a
 * success message or the backend error message.
 *
 * BAD_REQUEST means the token is invalid or has expired. The page shows the
 * backend message so the user understands why activation failed. It does not
 * navigate automatically after success: the user must click "Go to login" so
 * they see the confirmation and are not confused.
 */
@Component({
  selector: 'app-activate-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './activate-page.page.html',
  styleUrl: './activate-page.page.scss',
})
export class ActivatePagePage implements OnInit {
  // inject() replaces constructor injection in Angular 21
  private readonly route = inject(ActivatedRoute);
  private readonly authFeature = inject(AuthFeature);

  /** The current UI state: loading, success, or error. */
  readonly state = signal<ActivationState>('loading');

  /** The backend error message when state === 'error'. */
  readonly errorMessage = signal<string | null>(null);

  /**
   * Runs activation immediately when the component is created, without waiting
   * for user interaction. The token is in the URL, so there is nothing for the
   * user to do except wait.
   *
   * OnInit (rather than a constructor effect) is used because route snapshot
   * reading is side-effectful and should not run during injection.
   */
  ngOnInit(): void {
    // Read the token from the query parameter ?token=<value>
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('error');
      this.errorMessage.set('No activation token found in the URL. Please check your email link.');
      return;
    }
    this.authFeature.activateAccount(token).subscribe({
      next: (result) => {
        // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
        if (result.error) {
          const appError = mapError(result.error as Error);
          this.errorMessage.set(appError.message);
          this.state.set('error');
          return;
        }
        this.state.set('success');
      },
      error: () => {
        this.errorMessage.set('An unexpected error occurred. Please try again.');
        this.state.set('error');
      },
    });
  }
}
