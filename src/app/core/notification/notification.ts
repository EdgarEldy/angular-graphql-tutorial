import { inject, Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root',
})
export class Notification {
  private snackBar = inject(MatSnackBar);

  /**
   * Displays a success snackbar in the top-right corner for 4 seconds.
   *
   * The panelClass 'notification-success' maps to a CSS class defined in styles.scss that
   * overrides MatSnackBar's default colour with the application's success palette token.
   *
   * @param message - The human-readable success message to display.
   * @param config  - Optional MatSnackBarConfig overrides (duration, position, etc.).
   */
  success(message: string, config?: MatSnackBarConfig): void {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      panelClass: ['notification-success'],
      horizontalPosition: 'end',
      verticalPosition: 'top',
      ...config,
    });
  }

  /**
   * Displays an error snackbar for 8 seconds (longer than success to give the user time to read it).
   *
   * The panelClass 'notification-error' maps to a CSS class in styles.scss. A longer duration
   * is intentional: error messages often contain actionable text the user needs to process.
   *
   * @param message - The human-readable error message to display.
   * @param config  - Optional MatSnackBarConfig overrides.
   */
  error(message: string, config?: MatSnackBarConfig): void {
    this.snackBar.open(message, 'Close', {
      duration: 8000,
      panelClass: ['notification-error'],
      horizontalPosition: 'end',
      verticalPosition: 'top',
      ...config,
    });
  }

  /**
   * Displays a neutral informational snackbar for 5 seconds.
   *
   * Used for non-critical messages (e.g. "Copied to clipboard", "Saved draft"). The action
   * label is 'Dismiss' rather than 'Close' to signal that the user may continue without acting.
   *
   * @param message - The human-readable informational message to display.
   * @param config  - Optional MatSnackBarConfig overrides.
   */
  info(message: string, config?: MatSnackBarConfig): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      ...config,
    });
  }
}
