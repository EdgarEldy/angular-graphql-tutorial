import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AppError } from '../../../core/graphql/app-error.model';

/**
 * Inline error banner shown when a list or detail query fails.
 *
 * Every list screen must show an error state with a retry action. Centralising
 * this in a shared component ensures consistent styling and copy across features.
 * It avoids each feature needing to build its own error card layout.
 *
 * This is a purely presentational component: it receives the AppError through
 * a signal input and emits a retry event when the user clicks the button.
 * All retry logic (re-fetching the query) lives in the parent smart component.
 */
@Component({
  selector: 'app-error-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './error-banner.html',
  styleUrl: './error-banner.scss',
})
export class ErrorBanner {
  /**
   * The mapped error to display. The message comes from AppError.message which
   * is always a human-readable string (mapped from the backend or transport layer).
   */
  // input() is the signal-based replacement for @Input() in Angular 21
  readonly error = input.required<AppError>();

  /**
   * Emitted when the user clicks "Retry". The parent page component reacts
   * by re-firing the Apollo query (e.g. via watchQuery.refetch()).
   *
   * output() is the Angular 21 replacement for @Output() / EventEmitter.
   */
  readonly retryClicked = output<void>();
}
