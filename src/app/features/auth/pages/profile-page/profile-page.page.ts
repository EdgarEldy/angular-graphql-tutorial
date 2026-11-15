import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../../core/auth/auth.service';
import {
  UpdateProfileDialog,
  UpdateProfileDialogData,
} from '../../dialogs/update-profile/update-profile.dialog';

/**
 * Profile page (authenticated route: /profile).
 *
 * Displays the signed-in user's first name, last name, email, account status
 * and assigned roles. The data comes directly from the AuthService.currentUser
 * signal, which is populated at startup via restoreSession() and kept in sync
 * by updateSessionUser() after a successful updateProfile mutation. No extra
 * network call is made when the page loads.
 *
 * The "Edit profile" button opens UpdateProfileDialog. On success the dialog
 * closes with the updated SessionUser and this page applies it to the session
 * signal immediately so the shell toolbar also reflects the change.
 */
@Component({
  selector: 'app-profile-page-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatDividerModule,
  ],
  templateUrl: './profile-page.page.html',
  styleUrl: './profile-page.page.scss',
})
export class ProfilePagePage {
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);

  /** The signed-in user; guaranteed non-null because authGuard protects this route. */
  readonly user = this.authService.currentUser;

  /**
   * Opens the UpdateProfileDialog pre-populated with the current user's values.
   *
   * On dialog close with a result, the updated SessionUser is applied via
   * AuthService.updateSessionUser so both this page and the shell toolbar
   * update atomically without a me refetch.
   */
  openEditDialog(): void {
    const current = this.user();
    if (!current) return;

    const data: UpdateProfileDialogData = {
      firstName: current.firstName,
      lastName: current.lastName,
      email: current.email,
    };

    // Lazy import avoids a dependency cycle between the page and the dialog.
    void import('../../dialogs/update-profile/update-profile.dialog').then(
      ({ UpdateProfileDialog: Dlg }) => {
        const ref = this.dialog.open(Dlg, { data, width: '400px' });

        ref.afterClosed().subscribe((updated) => {
          if (updated) {
            // Sync the in-memory session so the shell and all computed signals update.
            this.authService.updateSessionUser(updated);
          }
        });
      },
    );
  }
}
