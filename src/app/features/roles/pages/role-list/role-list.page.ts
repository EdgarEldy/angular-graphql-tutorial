import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { Roles } from '../../data/roles';
import { RoleFormDialog, type RoleFormDialogData } from '../../dialogs/role-form/role-form.dialog';
import { ManagePermissionsDialog, type ManagePermissionsDialogData } from '../../dialogs/manage-permissions/manage-permissions.dialog';
import { ConfirmDialog, type ConfirmDialogData } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { Loading } from '../../../../shared/ui/loading/loading';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { ErrorBanner } from '../../../../shared/ui/error-banner/error-banner';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type { RoleFieldsFragment } from '../../../../core/graphql/generated/graphql';
import type { AppError } from '../../../../core/graphql/app-error.model';

/**
 * Role list page (admin only, route: /roles).
 *
 * Smart component: fetches the role list, coordinates create/edit/delete dialogs,
 * and opens the manage-permissions dialog for each role row.
 *
 * The roles query is not paginated by the backend (returns the full list).
 * A watchQuery is used so cache updates from the role-form dialog propagate
 * here without a manual refetch.
 */
@Component({
  selector: 'app-role-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    PageHeader,
    Loading,
    EmptyState,
    ErrorBanner,
  ],
  templateUrl: './role-list.page.html',
  styleUrl: './role-list.page.scss',
})
export class RoleListPage implements OnInit {
  // inject() replaces constructor injection in Angular 21
  private readonly rolesService = inject(Roles);
  private readonly dialog = inject(MatDialog);
  private readonly notification = inject(Notification);

  // DestroyRef passed to takeUntilDestroyed() in ngOnInit (outside injection context)
  private readonly destroyRef = inject(DestroyRef);

  readonly roles = signal<RoleFieldsFragment[]>([]);
  readonly loading = signal(true);
  readonly error = signal<AppError | null>(null);

  readonly displayedColumns = ['roleName', 'permissions', 'actions'];

  private queryRef = this.rolesService.watchRoles();

  /**
   * Subscribes to the roles watchQuery on init.
   *
   * @see takeUntilDestroyed
   */
  ngOnInit(): void {
    this.queryRef.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        if (result.errors?.length) {
          this.error.set(mapError(result.errors[0] as unknown as Error));
        } else {
          this.error.set(null);
          if (result.data?.roles) {
            this.roles.set([...result.data.roles]);
          }
        }
      },
    });
  }

  /**
   * Retries the roles list query after a fetch error.
   */
  retryLoad(): void {
    void this.queryRef.refetch();
  }

  /**
   * Opens the create-role dialog. Refetches on success because Apollo cannot
   * automatically insert the new role into the full-list result.
   */
  openCreateDialog(): void {
    const data: RoleFormDialogData = { role: null };
    this.dialog
      .open(RoleFormDialog, { data, width: '400px' })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => void this.queryRef.refetch());
  }

  /**
   * Opens the edit-role dialog pre-filled with the given role.
   *
   * @param role - The role to edit.
   */
  openEditDialog(role: RoleFieldsFragment): void {
    const data: RoleFormDialogData = { role };
    this.dialog.open(RoleFormDialog, { data, width: '400px' });
  }

  /**
   * Opens the manage-permissions dialog for the given role.
   *
   * @param role - The role whose permissions to manage.
   */
  openManagePermissionsDialog(role: RoleFieldsFragment): void {
    const data: ManagePermissionsDialogData = { role };
    this.dialog.open(ManagePermissionsDialog, { data, width: '560px' });
  }

  /**
   * Shows a confirmation dialog, then deletes the role.
   * Refetches the list after deletion.
   *
   * @param role - The role to delete.
   */
  deleteRole(role: RoleFieldsFragment): void {
    const confirmData: ConfirmDialogData = {
      title: 'Delete role',
      message: `Delete role "${role.roleName}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
    };
    this.dialog
      .open(ConfirmDialog, { data: confirmData })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => {
        this.rolesService.deleteRole(role.id).subscribe({
          next: (result) => {
            if (result.errors?.length) {
              const appError = mapError(result.errors[0] as unknown as Error);
              this.notification.error(appError.message);
            } else {
              this.notification.success('Role deleted successfully.');
              void this.queryRef.refetch();
            }
          },
          error: () => this.notification.error('Failed to delete role.'),
        });
      });
  }
}
