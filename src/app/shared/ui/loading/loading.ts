import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * Spinner overlay displayed while a list or detail screen is fetching data.
 *
 * Every list screen must show a loading state while the Apollo query is in
 * flight. This standalone component keeps the spinner markup in one place so
 * every feature gets the same visual treatment without duplicating HTML.
 *
 * The component has no inputs: it is shown or hidden by the parent via @if,
 * keeping the logic in the smart component and the presentation here.
 */
@Component({
  selector: 'app-loading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressSpinnerModule],
  templateUrl: './loading.html',
  styleUrl: './loading.scss',
})
export class Loading {}
