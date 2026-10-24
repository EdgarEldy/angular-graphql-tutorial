import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { Users } from '../../data/users';
import { UserFormDialog, type UserFormDialogData } from '../../dialogs/user-form/user-form.dialog';
import { ManageRolesDialog, type ManageRolesDialogData } from '../../dialogs/manage-roles/manage-roles.dialog';
import { ConfirmDialog, type ConfirmDialogData } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { Loading } from '../../../../shared/ui/loading/loading';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { ErrorBanner } from '../../../../shared/ui/error-banner/error-banner';
import { AuthService } from '../../../../core/auth/auth.service';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type { UserFieldsFragment } from '../../../../core/graphql/generated/graphql';
import type { AppError } from '../../../../core/graphql/app-error.model';

/** Page size options for the Material paginator. */
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;

/**
 * User list page (admin only, route: /users).
 *
 * Smart component: fetches the paginated user list, coordinates dialogs and
 * mutation calls. Presentational concerns (table layout, chips) live in the
 * template rather than in a separate dumb component because the data shape
 * closely matches the Material table configuration.
 *
 * Self-protection: lock, unlock, and delete actions are disabled on the row
 * that belongs to the currently logged-in user. The backend enforces the same
 * rule; the UI check is a UX safeguard.
 */
@Component({
  selector: 'app-user-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    PageHeader,
    Loading,
    EmptyState,
    ErrorBanner,
  ],
  templateUrl: './user-list.page.html',
  styleUrl: './user-list.page.scss',
})
export class UserListPage implements OnInit {
  // inject() replaces constructor injection in Angular 21
  private readonly usersService = inject(Users);
  private readonly dialog = inject(MatDialog);
  private readonly authService = inject(AuthService);
  private readonly notification = inject(Notification);

  readonly users = signal<UserFieldsFragment[]>([]);
  readonly loading = signal(true);
  readonly error = signal<AppError | null>(null);
  readonly totalElements = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly displayedColumns = ['name', 'email', 'status', 'roles', 'actions'];

  /** ID of the currently logged-in user. Used to disable self-actions. */
  readonly currentUserId = computed(() => this.authService.currentUser()?.id);

  // DestroyRef is injected to pass to takeUntilDestroyed() in ngOnInit,
  // where the injection context is no longer active.
  private readonly destroyRef = inject(DestroyRef);

  private queryRef = this.usersService.watchUsers(0, DEFAULT_PAGE_SIZE);

  /**
   * Subscribes to the watchQuery result on init.
   *
   * takeUntilDestroyed() is the Angular 16+ way to clean up subscriptions
   * that live for the component's entire lifetime. It avoids manual unsubscribe
   * and is compatible with the zoneless change detection model.
   */
  ngOnInit(): void {
    // takeUntilDestroyed(destroyRef) is called with the injected DestroyRef because
    // we are outside the constructor injection context (inside ngOnInit).
    this.queryRef.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        if (result.errors?.length) {
          this.error.set(mapError(result.errors[0] as unknown as Error));
        } else {
          this.error.set(null);
          if (result.data?.users) {
            this.users.set([...result.data.users.content]);
            this.totalElements.set(result.data.users.totalElements);
          }
        }
      },
    });
  }

  /**
   * Handles Material paginator page events.
   *
   * Updates the local page signals and calls refetch() with the new parameters.
   * watchQuery caches the previous page and Apollo will serve it from cache if
   * the user navigates back.
   *
   * @param event - The paginator page event containing pageIndex and pageSize.
   */
  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    void this.queryRef.refetch({ page: event.pageIndex, size: event.pageSize });
  }

  /**
   * Retries the user list query after a fetch error.
   */
  retryLoad(): void {
    void this.queryRef.refetch();
  }

  /**
   * Opens the create-user dialog.
   *
   * On dialog close with the saved user, refetches the list so pagination stays
   * correct (Apollo cannot know where to insert the new user in the sorted/paged list).
   */
  openCreateDialog(): void {
    const data: UserFormDialogData = { user: null };
    this.dialog
      .open(UserFormDialog, { data, width: '480px' })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => {
        void this.queryRef.refetch();
      });
  }

  /**
   * Opens the edit-user dialog pre-filled with the given user.
   *
   * The updated User is written into the cache by the mutation return value,
   * so the table row updates automatically without a refetch.
   *
   * @param user - The user to edit.
   */
  openEditDialog(user: UserFieldsFragment): void {
    const data: UserFormDialogData = { user };
    this.dialog.open(UserFormDialog, { data, width: '480px' });
  }

  /**
   * Opens the manage-roles dialog for the given user.
   *
   * The dialog handles role assignment mutations internally; the returned User
   * updates the cache so the chips in this table update without a refetch.
   *
   * @param user - The user whose roles to manage.
   */
  openManageRolesDialog(user: UserFieldsFragment): void {
    const data: ManageRolesDialogData = { user };
    this.dialog.open(ManageRolesDialog, { data, width: '560px' });
  }

  /**
   * Shows a confirmation dialog, then toggles accountLocked on the user.
   *
   * Disabled for the currently logged-in user (self-protection rule).
   *
   * @param user - The user to lock or unlock.
   */
  toggleLock(user: UserFieldsFragment): void {
    const action = user.accountLocked ? 'Unlock' : 'Lock';
    const confirmData: ConfirmDialogData = {
      title: `${action} user`,
      message: `Are you sure you want to ${action.toLowerCase()} ${user.firstName} ${user.lastName}?`,
      confirmLabel: action,
    };
    this.dialog
      .open(ConfirmDialog, { data: confirmData })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => {
        const mutation$ = user.accountLocked
          ? this.usersService.unlockUser(user.id)
          : this.usersService.lockUser(user.id);

        mutation$.subscribe({
          next: (result) => {
            if (result.errors?.length) {
              const appError = mapError(result.errors[0] as unknown as Error);
              this.notification.error(appError.message);
            } else {
              this.notification.success(`User ${action.toLowerCase()}ed successfully.`);
            }
          },
          error: () => this.notification.error('Failed to update user status.'),
        });
      });
  }

  /**
   * Shows a confirmation dialog, then deletes the user.
   *
   * After deletion, refetches the list because the removed row cannot be
   * evicted from the paginated result via cache normalisation alone.
   *
   * Disabled for the currently logged-in user (self-protection rule).
   *
   * @param user - The user to delete.
   */
  deleteUser(user: UserFieldsFragment): void {
    const confirmData: ConfirmDialogData = {
      title: 'Delete user',
      message: `Delete ${user.firstName} ${user.lastName}? This action cannot be undone.`,
      confirmLabel: 'Delete',
    };
    this.dialog
      .open(ConfirmDialog, { data: confirmData })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => {
        this.usersService.deleteUser(user.id).subscribe({
          next: (result) => {
            if (result.errors?.length) {
              const appError = mapError(result.errors[0] as unknown as Error);
              this.notification.error(appError.message);
            } else {
              this.notification.success('User deleted successfully.');
              void this.queryRef.refetch();
            }
          },
          error: () => this.notification.error('Failed to delete user.'),
        });
      });
  }

  /**
   * Returns true when the row belongs to the currently logged-in user.
   *
   * Used to disable lock, unlock, and delete actions on the current user's
   * own row so admins cannot accidentally lock themselves out.
   *
   * @param user - The user row to check.
   */
  isSelf(user: UserFieldsFragment): boolean {
    return user.id === this.currentUserId();
  }
}
