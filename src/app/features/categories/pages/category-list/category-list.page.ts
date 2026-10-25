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
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { Categories } from '../../data/categories';
import {
  CategoryFormDialog,
  type CategoryFormDialogData,
} from '../../dialogs/category-form/category-form.dialog';
import { ConfirmDialog, type ConfirmDialogData } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { Loading } from '../../../../shared/ui/loading/loading';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { ErrorBanner } from '../../../../shared/ui/error-banner/error-banner';
import { AuthService } from '../../../../core/auth/auth.service';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type { CategoryFieldsFragment } from '../../../../core/graphql/generated/graphql';
import type { AppError } from '../../../../core/graphql/app-error.model';

/** Page size options offered to the user via Material paginator. */
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;

/**
 * Category list page (route: /categories).
 *
 * Smart component: fetches the paginated category list, coordinates the
 * create/edit dialog and delete confirmation. Presentational concerns live
 * in the template directly; the table is simple enough that a separate dumb
 * component would add overhead without clarity.
 *
 * Admin-only actions (create, edit, delete) are hidden for non-admin users.
 * The backend enforces authorization on every mutation; the UI check is a UX
 * safeguard only.
 *
 * Deleting a category that still has products returns a BAD_REQUEST error.
 * This page surfaces the backend message via the notification service so the
 * user understands why the row was kept.
 */
@Component({
  selector: 'app-category-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    PageHeader,
    Loading,
    EmptyState,
    ErrorBanner,
  ],
  templateUrl: './category-list.page.html',
  styleUrl: './category-list.page.scss',
})
export class CategoryListPage implements OnInit {
  // inject() replaces constructor injection in Angular 21
  private readonly categoriesService = inject(Categories);
  private readonly dialog = inject(MatDialog);
  private readonly authService = inject(AuthService);
  private readonly notification = inject(Notification);

  readonly categories = signal<CategoryFieldsFragment[]>([]);
  readonly loading = signal(true);
  readonly error = signal<AppError | null>(null);
  readonly totalElements = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly displayedColumns = ['name', 'actions'];

  /**
   * True when the current user has the ADMIN role.
   *
   * computed() derives a signal from another signal -- isAdmin() is a signal
   * on AuthService, so this computed re-evaluates whenever the session changes.
   * Used to show/hide admin-only actions and conditionally pass actionLabel to
   * PageHeader.
   */
  readonly isAdmin = computed(() => this.authService.isAdmin());

  /**
   * The label passed to PageHeader's actionLabel input.
   *
   * PageHeader only renders the action button when actionLabel() is truthy.
   * Returning undefined for non-admins hides the Create button without any
   * conditional markup in the template.
   */
  readonly headerActionLabel = computed(() =>
    this.isAdmin() ? 'Create category' : undefined,
  );

  // DestroyRef is injected to pass to takeUntilDestroyed() in ngOnInit,
  // where the injection context is no longer active.
  private readonly destroyRef = inject(DestroyRef);

  private queryRef = this.categoriesService.watchCategories(0, DEFAULT_PAGE_SIZE);

  /**
   * Subscribes to the categories watchQuery on init.
   *
   * takeUntilDestroyed(destroyRef) is the Angular 16+ idiom for cleaning up
   * long-lived subscriptions. It completes the observable when the component
   * is destroyed, preventing memory leaks in a zoneless application where
   * Angular cannot rely on Zone.js to trigger change detection.
   */
  ngOnInit(): void {
    // takeUntilDestroyed(destroyRef) is called with the injected DestroyRef
    // because we are outside the constructor injection context (inside ngOnInit).
    this.queryRef.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
        if (result.error) {
          this.error.set(mapError(result.error as Error));
        } else {
          this.error.set(null);
          if (result.data?.categories) {
            // With errorPolicy:'all', Apollo v4 types data as MaybeDeepPartial.
            // At this point there are no errors so data is complete; assert the full type.
            this.categories.set([
              ...(result.data.categories.content as CategoryFieldsFragment[]),
            ]);
            // totalElements is typed as number | undefined in the partial type; default to 0
            this.totalElements.set(result.data.categories.totalElements ?? 0);
          }
        }
      },
    });
  }

  /**
   * Handles Material paginator page events.
   *
   * Updates the local page signals and calls refetch() with the new variables.
   * watchQuery caches previous pages so navigating back is instant.
   *
   * @param event - The paginator page event containing pageIndex and pageSize.
   */
  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    void this.queryRef.refetch({ page: event.pageIndex, size: event.pageSize });
  }

  /**
   * Retries the category list query after a fetch error.
   *
   * Called by the ErrorBanner component's retry button.
   */
  retryLoad(): void {
    void this.queryRef.refetch();
  }

  /**
   * Opens the create-category dialog.
   *
   * On dialog close with a truthy result (the saved category), refetches the
   * list because Apollo cannot know where to insert the new category in the
   * paginated and sorted result.
   */
  openCreateDialog(): void {
    const data: CategoryFormDialogData = { category: null };
    this.dialog
      .open(CategoryFormDialog, { data, width: '480px' })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => {
        void this.queryRef.refetch();
      });
  }

  /**
   * Opens the edit-category dialog pre-filled with the given category.
   *
   * The mutation returns the updated Category, which Apollo normalises into
   * the InMemoryCache by (Category:<id>). The list row updates automatically
   * without a refetch because watchQuery observes the cache.
   *
   * @param category - The category to edit.
   */
  openEditDialog(category: CategoryFieldsFragment): void {
    const data: CategoryFormDialogData = { category };
    this.dialog.open(CategoryFormDialog, { data, width: '480px' });
  }

  /**
   * Shows a confirmation dialog, then deletes the category.
   *
   * CategoriesService.deleteCategory() uses an Apollo update callback that calls
   * cache.evict() to remove the Category entity immediately, so the watchQuery
   * drops the row without a network round-trip. No explicit refetch() is needed.
   *
   * If the backend returns BAD_REQUEST (the category still has products), the
   * error message from the backend is surfaced verbatim via the notification
   * service. The row is kept in place because no eviction or refetch happens
   * when the mutation returns an error.
   *
   * @param category - The category to delete.
   */
  deleteCategory(category: CategoryFieldsFragment): void {
    const confirmData: ConfirmDialogData = {
      title: 'Delete category',
      message: `Delete "${category.categoryName}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
    };
    this.dialog
      .open(ConfirmDialog, { data: confirmData })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => {
        this.categoriesService.deleteCategory(category.id).subscribe({
          next: (result) => {
            // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
            if (result.error) {
              // Surface the backend message verbatim (required for BAD_REQUEST when
              // category still has products -- the business message explains why).
              this.notification.error(mapError(result.error as Error).message);
            } else {
              // cache.evict() in the service already removed the row; just notify.
              this.notification.success('Category deleted successfully.');
            }
          },
          error: () => this.notification.error('Failed to delete category.'),
        });
      });
  }
}
