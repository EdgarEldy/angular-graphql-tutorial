import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

/**
 * Data injected into ConfirmDialog via MAT_DIALOG_DATA.
 *
 * Having a typed data shape prevents callers from passing arbitrary objects and
 * makes every usage site self-documenting.
 */
export interface ConfirmDialogData {
  /** The dialog heading (e.g. "Delete user"). */
  title: string;
  /** The explanatory body text (e.g. "This action cannot be undone."). */
  message: string;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
}

/**
 * Reusable confirmation dialog used for destructive actions (delete, lock).
 *
 * Opened with MatDialog.open(ConfirmDialog, { data: ConfirmDialogData }).
 * Closes with `true` when the user confirms and `false` (or undefined on
 * backdrop click) otherwise. The caller should treat any non-true result
 * as a cancellation.
 *
 * Keeping confirmations in one component eliminates per-feature duplication
 * and ensures all destructive-action dialogs have a consistent UX.
 */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  // inject() replaces constructor injection in Angular 21 -- avoids boilerplate
  // and works identically in standalone components.
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialog>);

  /**
   * The label for the confirm button, defaulting to "Confirm" when the caller
   * did not supply one.
   */
  get confirmLabel(): string {
    return this.data.confirmLabel ?? 'Confirm';
  }

  /**
   * The label for the cancel button, defaulting to "Cancel".
   */
  get cancelLabel(): string {
    return this.data.cancelLabel ?? 'Cancel';
  }

  /**
   * Closes the dialog with `true` to signal that the user confirmed the action.
   * The caller checks the afterClosed() value to decide whether to proceed.
   */
  confirm(): void {
    this.dialogRef.close(true);
  }

  /**
   * Closes the dialog with `false` to signal a cancellation.
   * The caller's afterClosed() subscription will receive false and must no-op.
   */
  cancel(): void {
    this.dialogRef.close(false);
  }
}
