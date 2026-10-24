import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Reusable page header displayed at the top of every list page.
 *
 * Renders a title and an optional action button (e.g. "Create" for admin pages).
 * By keeping this outside each feature's page component, all list pages share the
 * same visual treatment without copy-pasting markup or styles.
 *
 * This is a purely presentational (dumb) component: it receives data through
 * signal inputs and emits events through outputs, never performing I/O itself.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
})
export class PageHeader {
  /** The page title displayed in the header. */
  // input() is the signal-based replacement for @Input() in Angular 21
  readonly title = input.required<string>();

  /**
   * Optional label for the primary action button.
   * When omitted the button is not rendered.
   */
  readonly actionLabel = input<string | undefined>(undefined);

  /**
   * Optional Material icon name for the action button.
   * Defaults to "add" when an actionLabel is present but no icon is provided.
   */
  readonly actionIcon = input<string>('add');

  /**
   * Emitted when the user clicks the primary action button.
   *
   * output() is the signal-based replacement for @Output/EventEmitter in Angular 21.
   * The parent page component listens to this event and opens the create dialog.
   */
  // output() replaces @Output() EventEmitter -- the parent uses (actionClicked)="handler()"
  readonly actionClicked = output<void>();
}
