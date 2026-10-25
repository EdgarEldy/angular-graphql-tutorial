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
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { Products } from '../../data/products';
import { CategoryOptions } from '../../../categories/data/category-options';
import {
  ProductFormDialog,
  type ProductFormDialogData,
} from '../../dialogs/product-form/product-form.dialog';
import { ConfirmDialog, type ConfirmDialogData } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { Loading } from '../../../../shared/ui/loading/loading';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { ErrorBanner } from '../../../../shared/ui/error-banner/error-banner';
import { AuthService } from '../../../../core/auth/auth.service';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type {
  GetCategoryOptionsQuery,
  ProductFieldsFragment,
} from '../../../../core/graphql/generated/graphql';
import type { AppError } from '../../../../core/graphql/app-error.model';

/** Page size options offered to the user via Material paginator. */
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;

/**
 * Product list page (route: /products).
 *
 * Smart component: fetches the paginated product list, provides a category
 * filter that resets to the first page on change, and coordinates the
 * create/edit dialog and delete confirmation. The ProductFields fragment
 * includes category { ...CategoryFields } so the table is always one
 * request, never N+1 per row.
 *
 * Admin-only actions (create, edit, delete) are hidden for non-admin users.
 * The backend enforces authorization on every mutation; the UI check is a UX
 * safeguard only.
 */
@Component({
  selector: 'app-product-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    CurrencyPipe,
    PageHeader,
    Loading,
    EmptyState,
    ErrorBanner,
  ],
  templateUrl: './product-list.page.html',
  styleUrl: './product-list.page.scss',
})
export class ProductListPage implements OnInit {
  // inject() replaces constructor injection in Angular 21
  private readonly productsService = inject(Products);
  private readonly categoryOptions = inject(CategoryOptions);
  private readonly dialog = inject(MatDialog);
  private readonly authService = inject(AuthService);
  private readonly notification = inject(Notification);

  readonly products = signal<ProductFieldsFragment[]>([]);
  readonly loading = signal(true);
  readonly error = signal<AppError | null>(null);
  readonly totalElements = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  /**
   * Currently selected category ID used as the filter for the products query.
   *
   * null means "all products" -- the backend interprets a missing/null categoryId
   * as no filter. The signal is updated by onCategoryChange() and passed directly
   * to the watchProducts QueryRef variables via refetch().
   */
  readonly selectedCategoryId = signal<string | null>(null);

  /**
   * Category options list for the filter MatSelect.
   *
   * Loaded from CategoryOptions so the same Apollo cache entry is reused if
   * the categories feature has already fetched it. The options are only used
   * for the filter UI and are not part of the main products query.
   */
  readonly categories = signal<GetCategoryOptionsQuery['categories']['content']>([]);

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly displayedColumns = ['name', 'category', 'unitPrice', 'actions'];

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
    this.isAdmin() ? 'Create product' : undefined,
  );

  // DestroyRef is injected to pass to takeUntilDestroyed() in ngOnInit,
  // where the injection context is no longer active.
  private readonly destroyRef = inject(DestroyRef);

  private readonly queryRef = this.productsService.watchProducts(
    null,
    0,
    DEFAULT_PAGE_SIZE,
  );

  private readonly categoryQueryRef = this.categoryOptions.watchOptions();

  /**
   * Subscribes to the products watchQuery and the category options on init.
   *
   * takeUntilDestroyed(destroyRef) is the Angular 16+ idiom for cleaning up
   * long-lived subscriptions. It completes the observable when the component
   * is destroyed, preventing memory leaks in a zoneless application where
   * Angular cannot rely on Zone.js to trigger change detection.
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
          if (result.data?.products) {
            // With errorPolicy:'all', Apollo v4 types data as MaybeDeepPartial.
            // At this point there are no errors so data is complete; assert the full type.
            this.products.set([
              ...(result.data.products.content as ProductFieldsFragment[]),
            ]);
            // totalElements is typed as number | undefined in the partial type; default to 0
            this.totalElements.set(result.data.products.totalElements ?? 0);
          }
        }
      },
    });

    // Subscribe to category options to populate the filter select
    this.categoryQueryRef.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (result.data?.categories?.content) {
            // With errorPolicy:'all', Apollo v4 types data as MaybeDeepPartial.
            // At this point there are no errors so data is complete; assert the full type.
            this.categories.set(
              result.data.categories.content as GetCategoryOptionsQuery['categories']['content'],
            );
          }
        },
      });
  }

  /**
   * Handles Material paginator page events.
   *
   * Updates the local page signals and calls refetch() with the new variables,
   * preserving the active category filter.
   *
   * @param event - The paginator page event containing pageIndex and pageSize.
   */
  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    void this.queryRef.refetch({
      categoryId: this.selectedCategoryId(),
      page: event.pageIndex,
      size: event.pageSize,
    });
  }

  /**
   * Handles category filter changes from the MatSelect.
   *
   * Resets pageIndex to 0 when the filter changes so the user always sees
   * the first page of results for the new category, not a stale page offset
   * that may exceed the new result set.
   *
   * @param categoryId - The selected category ID, or null to show all products.
   */
  onCategoryChange(categoryId: string | null): void {
    this.selectedCategoryId.set(categoryId);
    // Reset to first page when filter changes -- the old page index may
    // be out of range for the newly filtered result set.
    this.pageIndex.set(0);
    void this.queryRef.refetch({
      categoryId,
      page: 0,
      size: this.pageSize(),
    });
  }

  /**
   * Retries the product list query after a fetch error.
   *
   * Called by the ErrorBanner component's retry button.
   */
  retryLoad(): void {
    void this.queryRef.refetch();
  }

  /**
   * Opens the create-product dialog.
   *
   * On dialog close with a truthy result (the saved product), refetches the
   * list because Apollo cannot know where to insert the new product in the
   * paginated and sorted result.
   */
  openCreateDialog(): void {
    const data: ProductFormDialogData = { product: null };
    this.dialog
      .open(ProductFormDialog, { data, width: '480px' })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => {
        void this.queryRef.refetch();
      });
  }

  /**
   * Opens the edit-product dialog pre-filled with the given product.
   *
   * The mutation returns the updated Product (including its nested Category),
   * which Apollo normalises into the InMemoryCache by (Product:<id>). The list
   * row updates automatically without a refetch because watchQuery observes the
   * cache.
   *
   * @param product - The product to edit.
   */
  openEditDialog(product: ProductFieldsFragment): void {
    const data: ProductFormDialogData = { product };
    this.dialog.open(ProductFormDialog, { data, width: '480px' });
  }

  /**
   * Shows a confirmation dialog, then deletes the product.
   *
   * ProductsService.deleteProduct() uses an Apollo update callback that calls
   * cache.evict() to remove the Product entity immediately, so the watchQuery
   * drops the row without a network round-trip. No explicit refetch() is needed.
   *
   * @param product - The product to delete.
   */
  deleteProduct(product: ProductFieldsFragment): void {
    const confirmData: ConfirmDialogData = {
      title: 'Delete product',
      message: `Delete "${product.productName}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
    };
    this.dialog
      .open(ConfirmDialog, { data: confirmData })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => {
        this.productsService.deleteProduct(product.id).subscribe({
          next: (result) => {
            // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
            if (result.error) {
              this.notification.error(mapError(result.error as Error).message);
            } else {
              // cache.evict() in the service already removed the row; just notify.
              this.notification.success('Product deleted successfully.');
            }
          },
          error: () => this.notification.error('Failed to delete product.'),
        });
      });
  }
}
