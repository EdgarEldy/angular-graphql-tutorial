import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Roles } from '../../data/roles';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type {
  AssignPermissionToRoleMutation,
  PermissionFieldsFragment,
  RemovePermissionFromRoleMutation,
  RoleFieldsFragment,
} from '../../../../core/graphql/generated/graphql';
import type { Apollo } from 'apollo-angular';

/**
 * Data passed to ManagePermissionsDialog via MAT_DIALOG_DATA.
 */
export interface ManagePermissionsDialogData {
  role: RoleFieldsFragment;
}

/**
 * "Manage permissions" dialog opened from the role list row.
 *
 * Shows the role's currently assigned permissions as removable chips and a
 * select field listing permissions not yet assigned. Permission assignment
 * mutations return the updated Role which Apollo normalises into the cache, so
 * the role-list table reflects the change without a manual refetch.
 *
 * The dialog fetches all available permissions on open via the Roles service
 * watchPermissions() QueryRef. This gives it a live list that reacts to
 * permissions created in another tab during the session.
 */
@Component({
  selector: 'app-manage-permissions-dialog',
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
  templateUrl: './manage-permissions.dialog.html',
  styleUrl: './manage-permissions.dialog.scss',
})
export class ManagePermissionsDialog {
  // inject() replaces constructor injection in Angular 21
  readonly data = inject<ManagePermissionsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ManagePermissionsDialog>);
  private readonly rolesService = inject(Roles);
  private readonly notification = inject(Notification);

  /** The role whose permissions are being managed. Updated on every mutation result. */
  readonly role = signal<RoleFieldsFragment>({ ...this.data.role });

  /** All global permissions fetched from the backend. */
  readonly allPermissions = signal<PermissionFieldsFragment[]>([]);
  readonly loadingPermissions = signal(true);
  readonly mutating = signal(false);

  /** Control holding the selected permission id to assign. */
  readonly addPermissionControl = new FormControl<string | null>(null);

  /**
   * Permissions not yet assigned to the role: shown in the add-permission
   * select. computed() re-derives this whenever allPermissions or role changes,
   * so the select stays accurate after each assignment without a manual filter.
   */
  readonly availablePermissions = computed(() => {
    const assignedIds = new Set(this.role().permissions.map((p) => p.id));
    return this.allPermissions().filter((p) => !assignedIds.has(p.id));
  });

  constructor() {
    // Fetch all permissions on dialog open; takeUntilDestroyed() cleans up on close.
    // watchQuery keeps the list current if the user creates permissions elsewhere.
    this.rolesService.watchPermissions().valueChanges.pipe(takeUntilDestroyed()).subscribe({
      next: (result) => {
        this.loadingPermissions.set(false);
        if (result.data?.permissions) {
          // DeepPartialObject: cast to PermissionFieldsFragment[] when data is present
          this.allPermissions.set([...(result.data.permissions as PermissionFieldsFragment[])]);
        }
      },
      error: () => this.loadingPermissions.set(false),
    });
  }

  /**
   * Assigns the selected permission to the role.
   *
   * The mutation returns the updated Role. We update the local role signal so
   * the chip list reflects the change immediately, and Apollo normalises the
   * result into the cache so the role-list table also updates.
   */
  addPermission(): void {
    const permissionId = this.addPermissionControl.value;
    if (!permissionId || this.mutating()) return;

    this.mutating.set(true);
    this.rolesService.assignPermissionToRole(this.role().id, permissionId).subscribe({
      next: (result: Apollo.MutateResult<AssignPermissionToRoleMutation>) => {
        this.mutating.set(false);
        // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
        if (result.error) {
          const appError = mapError(result.error as Error);
          this.notification.error(appError.message);
          return;
        }
        const updatedRole = result.data?.assignPermissionToRole;
        if (updatedRole) {
          this.role.set(updatedRole);
          this.addPermissionControl.reset();
        }
      },
      error: () => {
        this.mutating.set(false);
        this.notification.error('Failed to assign permission.');
      },
    });
  }

  /**
   * Removes a permission from the role.
   *
   * Updates the local role signal from the mutation result so the chips update
   * without a refetch.
   *
   * @param permission - The permission to remove.
   */
  removePermission(permission: PermissionFieldsFragment): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    this.rolesService.removePermissionFromRole(this.role().id, permission.id).subscribe({
      next: (result: Apollo.MutateResult<RemovePermissionFromRoleMutation>) => {
        this.mutating.set(false);
        // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
        if (result.error) {
          const appError = mapError(result.error as Error);
          this.notification.error(appError.message);
          return;
        }
        const updatedRole = result.data?.removePermissionFromRole;
        if (updatedRole) {
          this.role.set(updatedRole);
        }
      },
      error: () => {
        this.mutating.set(false);
        this.notification.error('Failed to remove permission.');
      },
    });
  }

  /**
   * Closes the dialog. The role changes are reflected in the cache through the
   * mutation return values so no extra data needs to be passed back.
   */
  close(): void {
    this.dialogRef.close();
  }
}
