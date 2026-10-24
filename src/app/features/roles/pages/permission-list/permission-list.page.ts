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
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { Roles } from '../../data/roles';
import { PermissionFormDialog, type PermissionFormDialogData } from '../../dialogs/permission-form/permission-form.dialog';
import { ConfirmDialog, type ConfirmDialogData } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { Loading } from '../../../../shared/ui/loading/loading';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { ErrorBanner } from '../../../../shared/ui/error-banner/error-banner';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type { PermissionFieldsFragment } from '../../../../core/graphql/generated/graphql';
import type { AppError } from '../../../../core/graphql/app-error.model';

/**
 * Permission list page (admin only, accessed via /roles tab or separate route).
 *
 * Shows all permissions as a simple table with resource and action columns.
 * Permissions can be created and deleted here. Assigning permissions to roles
 * is handled in the ManagePermissionsDialog opened from the role list row.
 */
@Component({
  selector: 'app-permission-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    PageHeader,
    Loading,
    EmptyState,
    ErrorBanner,
  ],
  templateUrl: './permission-list.page.html',
  styleUrl: './permission-list.page.scss',
})
export class PermissionListPage implements OnInit {
  // inject() replaces constructor injection in Angular 21
  private readonly rolesService = inject(Roles);
  private readonly dialog = inject(MatDialog);
  private readonly notification = inject(Notification);

  // DestroyRef passed to takeUntilDestroyed() in ngOnInit (outside injection context)
  private readonly destroyRef = inject(DestroyRef);

  readonly permissions = signal<PermissionFieldsFragment[]>([]);
  readonly loading = signal(true);
  readonly error = signal<AppError | null>(null);

  readonly displayedColumns = ['resource', 'action', 'actions'];

  private queryRef = this.rolesService.watchPermissions();

  /**
   * Subscribes to the permissions watchQuery on init.
   */
  ngOnInit(): void {
    this.queryRef.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
        if (result.error) {
          this.error.set(mapError(result.error as Error));
        } else {
          this.error.set(null);
          if (result.data?.permissions) {
            // DeepPartialObject: cast to PermissionFieldsFragment[] when no error is present
            this.permissions.set([...(result.data.permissions as PermissionFieldsFragment[])]);
          }
        }
      },
    });
  }

  /** Retries the permissions query after a fetch error. */
  retryLoad(): void {
    void this.queryRef.refetch();
  }

  /** Opens the create-permission dialog. Refetches on success. */
  openCreateDialog(): void {
    const data: PermissionFormDialogData = {};
    this.dialog
      .open(PermissionFormDialog, { data, width: '400px' })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => void this.queryRef.refetch());
  }

  /**
   * Shows a confirmation dialog, then deletes the permission.
   *
   * @param permission - The permission to delete.
   */
  deletePermission(permission: PermissionFieldsFragment): void {
    const confirmData: ConfirmDialogData = {
      title: 'Delete permission',
      message: `Delete permission "${permission.resource}:${permission.action}"? This will also remove it from all roles.`,
      confirmLabel: 'Delete',
    };
    this.dialog
      .open(ConfirmDialog, { data: confirmData })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => {
        this.rolesService.deletePermission(permission.id).subscribe({
          next: (result) => {
            // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
            if (result.error) {
              this.notification.error(mapError(result.error as Error).message);
            } else {
              this.notification.success('Permission deleted successfully.');
              void this.queryRef.refetch();
            }
          },
          error: () => this.notification.error('Failed to delete permission.'),
        });
      });
  }
}
