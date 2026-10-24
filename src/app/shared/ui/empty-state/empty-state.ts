import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Presentational placeholder rendered when a list has zero items.
 *
 * Every list screen must display three explicit states: loading, error, and
 * empty. This component covers the empty state so each feature does not
 * need to copy the icon + message layout.
 *
 * The icon and message are configurable through signal inputs so the component
 * is reused by every feature with appropriate copy.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
})
export class EmptyState {
  /** Material icon name shown above the message. Defaults to "inbox". */
  // input() is the signal-based replacement for @Input() in Angular 21
  readonly icon = input<string>('inbox');

  /** Human-readable message explaining why the list is empty. */
  readonly message = input<string>('No items found.');
}
