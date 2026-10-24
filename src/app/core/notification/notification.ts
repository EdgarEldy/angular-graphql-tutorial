import { inject, Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root',
})
export class Notification {
  private snackBar = inject(MatSnackBar);

  success(message: string, config?: MatSnackBarConfig): void {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      panelClass: ['notification-success'],
      horizontalPosition: 'end',
      verticalPosition: 'top',
      ...config,
    });
  }

  error(message: string, config?: MatSnackBarConfig): void {
    this.snackBar.open(message, 'Close', {
      duration: 8000,
      panelClass: ['notification-error'],
      horizontalPosition: 'end',
      verticalPosition: 'top',
      ...config,
    });
  }

  info(message: string, config?: MatSnackBarConfig): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      ...config,
    });
  }
}
