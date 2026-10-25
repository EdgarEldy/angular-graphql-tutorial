import {
  ChangeDetectionStrategy,
  Component,
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
import { Customers } from '../../data/customers';
import {
  CustomerFormDialog,
  type CustomerFormDialogData,
} from '../../dialogs/customer-form/customer-form.dialog';
import { ConfirmDialog, type ConfirmDialogData } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { Loading } from '../../../../shared/ui/loading/loading';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { ErrorBanner } from '../../../../shared/ui/error-banner/error-banner';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type { CustomerFieldsFragment } from '../../../../core/graphql/generated/graphql';
import type { AppError } from '../../../../core/graphql/app-error.model';

/** Page size options offered to the user via Material paginator. */
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;

/**
 * Customer list page (route: /customers).
 *
 * Smart component: fetches the paginated customer list and coordinates
 * the create/edit dialog and delete confirmation. Unlike the products page,
 * there is no category filter -- customers are not categorised.
 *
 * Three explicit states are managed: loading (initial fetch in progress),
 * error (query failed, retry available), and empty/data (table or empty state).
 * This aligns with the project's error-handling spec which requires every list
 * screen to handle all three states explicitly.
 */
@Component({
  selector: 'app-customer-list-page',
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
  templateUrl: './customer-list.page.html',
  styleUrl: './customer-list.page.scss',
})
export class CustomerListPage implements OnInit {
  // inject() replaces constructor injection in Angular 21
  private readonly customersService = inject(Customers);
  private readonly dialog = inject(MatDialog);
  private readonly notification = inject(Notification);

  readonly customers = signal<CustomerFieldsFragment[]>([]);
  readonly loading = signal(true);
  readonly error = signal<AppError | null>(null);
  readonly totalElements = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly displayedColumns = ['firstName', 'lastName', 'email', 'telephone', 'address', 'actions'];

  // DestroyRef is injected to pass to takeUntilDestroyed() in ngOnInit,
  // where the injection context is no longer active.
  private readonly destroyRef = inject(DestroyRef);

  private readonly queryRef = this.customersService.watchCustomers(0, DEFAULT_PAGE_SIZE);

  /**
   * Subscribes to the customers watchQuery on init.
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
          if (result.data?.customers) {
            // With errorPolicy:'all', Apollo v4 types data as MaybeDeepPartial.
            // At this point there are no errors so data is complete; assert the full type.
            this.customers.set([
              ...(result.data.customers.content as CustomerFieldsFragment[]),
            ]);
            // totalElements is typed as number | undefined in the partial type; default to 0
            this.totalElements.set(result.data.customers.totalElements ?? 0);
          }
        }
      },
    });
  }

  /**
   * Handles Material paginator page events.
   *
   * Updates the local page signals and calls refetch() with the new variables.
   *
   * @param event - The paginator page event containing pageIndex and pageSize.
   */
  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    void this.queryRef.refetch({
      page: event.pageIndex,
      size: event.pageSize,
    });
  }

  /**
   * Retries the customer list query after a fetch error.
   *
   * Called by the ErrorBanner component's retry button.
   */
  retryLoad(): void {
    void this.queryRef.refetch();
  }

  /**
   * Opens the create-customer dialog.
   *
   * On dialog close with a truthy result (the saved customer), refetches the
   * list because Apollo cannot know where to insert the new customer in the
   * paginated result.
   */
  openCreateDialog(): void {
    const data: CustomerFormDialogData = { customer: null };
    this.dialog
      .open(CustomerFormDialog, { data, width: '480px' })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => {
        void this.queryRef.refetch();
      });
  }

  /**
   * Opens the edit-customer dialog pre-filled with the given customer.
   *
   * The mutation returns the updated Customer entity, which Apollo normalises
   * into the InMemoryCache by (Customer:<id>). The list row updates automatically
   * without a refetch because watchQuery observes the cache.
   *
   * @param customer - The customer to edit.
   */
  openEditDialog(customer: CustomerFieldsFragment): void {
    const data: CustomerFormDialogData = { customer };
    this.dialog.open(CustomerFormDialog, { data, width: '480px' });
  }

  /**
   * Shows a confirmation dialog, then deletes the customer.
   *
   * CustomersService.deleteCustomer() uses an Apollo update callback that calls
   * cache.evict() to remove the Customer entity immediately, so the watchQuery
   * drops the row without a network round-trip. No explicit refetch() is needed.
   *
   * If the backend rejects the deletion (e.g. the customer has orders), result.error
   * is a BAD_REQUEST and we surface the backend's message as a notification so the
   * user understands why the row was not removed.
   *
   * @param customer - The customer to delete.
   */
  deleteCustomer(customer: CustomerFieldsFragment): void {
    const confirmData: ConfirmDialogData = {
      title: 'Delete customer',
      message: `Delete "${customer.firstName} ${customer.lastName}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
    };
    this.dialog
      .open(ConfirmDialog, { data: confirmData })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => {
        this.customersService.deleteCustomer(customer.id).subscribe({
          next: (result) => {
            // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
            if (result.error) {
              // BAD_REQUEST here means the customer has orders; surface the
              // backend message directly so the user knows the exact reason.
              this.notification.error(mapError(result.error as Error).message);
            } else {
              // cache.evict() in the service already removed the row; just notify.
              this.notification.success('Customer deleted successfully.');
            }
          },
          error: () => this.notification.error('Failed to delete customer.'),
        });
      });
  }
}
