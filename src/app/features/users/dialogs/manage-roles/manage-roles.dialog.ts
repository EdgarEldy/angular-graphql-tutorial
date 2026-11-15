import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Users } from '../../data/users';
import { Roles } from '../../../roles/data/roles';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import {
  type RoleFieldsFragment,
  type UpdateUserRolesInput,
  type UserFieldsFragment,
} from '../../../../core/graphql/generated/graphql';

/**
 * Data passed to ManageRolesDialog via MAT_DIALOG_DATA.
 */
export interface ManageRolesDialogData {
  user: UserFieldsFragment;
}

/**
 * "Manage roles" dialog opened from the user list row.
 *
 * Shows the user's currently assigned roles as removable chips and a select
 * field listing the roles not yet assigned. Role assignment mutations return
 * the updated User which Apollo normalises into the cache, so the chips update
 * immediately without the dialog needing to maintain its own role list state.
 *
 * The dialog fetches all available roles on open using a one-shot watchQuery.
 * If the role list is needed elsewhere it should be moved to a shared service;
 * scoping it here avoids premature abstraction.
 */
@Component({
  selector: 'app-manage-roles-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './manage-roles.dialog.html',
  styleUrl: './manage-roles.dialog.scss',
})
export class ManageRolesDialog {
  // inject() replaces constructor injection in Angular 21
  readonly data = inject<ManageRolesDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ManageRolesDialog>);
  private readonly usersService = inject(Users);
  // Roles service provides watchRoles() -- dialogs must not inject Apollo directly
  private readonly rolesService = inject(Roles);
  private readonly notification = inject(Notification);

  /** The user whose roles are being managed. Updated on every mutation result. */
  readonly user = signal<UserFieldsFragment>({ ...this.data.user });

  /** All available roles fetched from the backend. */
  readonly allRoles = signal<RoleFieldsFragment[]>([]);
  readonly loadingRoles = signal(true);
  readonly mutating = signal(false);

  /** Control holding the selected role to add. */
  readonly addRoleControl = new FormControl<string | null>(null);

  /**
   * Roles not yet assigned to the user: shown in the add-role select.
   * Derived from allRoles minus the user's current roles so the select
   * never shows a role that is already assigned.
   */
  readonly availableRoles = computed(() => {
    const assignedIds = new Set(this.user().roles.map((r) => r.id));
    return this.allRoles().filter((r) => !assignedIds.has(r.id));
  });

  constructor() {
    // Fetch available roles on dialog open via the feature service (not Apollo directly).
    // takeUntilDestroyed() cleans up the subscription when the dialog is closed.
    this.rolesService
      .watchRoles()
      .valueChanges.pipe(takeUntilDestroyed())
      .subscribe({
        next: (result) => {
          this.loadingRoles.set(false);
          if (result.data?.roles) {
            // DeepPartialObject: cast to RoleFieldsFragment[] when data is present
            this.allRoles.set([...(result.data.roles as RoleFieldsFragment[])]);
          }
        },
        error: () => this.loadingRoles.set(false),
      });
  }

  /**
   * Assigns the selected role to the user.
   *
   * Uses `updateUserRoles` with `{ add: [roleId] }` as required by the new
   * batch API. The mutation returns the updated User which is normalised into
   * the cache; we also update the local user signal for immediate chip feedback.
   */
  addRole(): void {
    const roleId = this.addRoleControl.value;
    if (!roleId || this.mutating()) return;

    this.mutating.set(true);
    // add: [roleId] batches a single assignment -- the array allows future multi-select
    const input: UpdateUserRolesInput = { add: [roleId] };
    this.usersService.updateUserRoles(this.user().id, input).subscribe({
      next: (result) => {
        this.mutating.set(false);
        // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
        if (result.error) {
          this.notification.error(mapError(result.error as Error).message);
          return;
        }
        const updatedUser = result.data?.updateUserRoles;
        if (updatedUser) {
          this.user.set(updatedUser);
          this.addRoleControl.reset();
        }
      },
      error: () => {
        this.mutating.set(false);
        this.notification.error('Failed to assign role.');
      },
    });
  }

  /**
   * Removes a role from the user.
   *
   * Uses `updateUserRoles` with `{ remove: [roleId] }` per the batch API
   * contract. Updates the local user signal from the mutation result so the
   * chips update without a refetch.
   *
   * @param role - The role to remove.
   */
  removeRole(role: { id: string; roleName: string }): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    // remove: [role.id] targets a single role -- same batch input, different array
    const input: UpdateUserRolesInput = { remove: [role.id] };
    this.usersService.updateUserRoles(this.user().id, input).subscribe({
      next: (result) => {
        this.mutating.set(false);
        // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
        if (result.error) {
          this.notification.error(mapError(result.error as Error).message);
          return;
        }
        const updatedUser = result.data?.updateUserRoles;
        if (updatedUser) {
          this.user.set(updatedUser);
        }
      },
      error: () => {
        this.mutating.set(false);
        this.notification.error('Failed to remove role.');
      },
    });
  }

  /**
   * Closes the dialog. The user changes are reflected in the cache through
   * the mutation return values, so no additional data needs to be passed back.
   */
  close(): void {
    this.dialogRef.close();
  }
}
