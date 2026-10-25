import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { Orders } from '../../data/orders';
import {
  OrderFormDialog,
  type OrderFormDialogResult,
} from '../../dialogs/order-form/order-form.dialog';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { Loading } from '../../../../shared/ui/loading/loading';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { ErrorBanner } from '../../../../shared/ui/error-banner/error-banner';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type {
  GetCustomerOptionsQuery,
  OrderFieldsFragment,
} from '../../../../core/graphql/generated/graphql';
import type { AppError } from '../../../../core/graphql/app-error.model';

/** Page size options offered to the user via Material paginator. */
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;

/**
 * Order list page (route: /orders).
 *
 * Smart component: fetches the paginated order list with an optional customer
 * filter, subscribes to the orderCreated WebSocket subscription to show new
 * orders in real time, and opens the create dialog.
 *
 * Three explicit states are managed: loading (initial fetch in progress),
 * error (query failed, retry available), and empty/data (table or empty state).
 * A fourth signal -- liveStatus -- tracks the WebSocket connection health and
 * shows a discreet "live updates unavailable" chip when disconnected.
 *
 * The subscription deduplicates incoming orders by id to handle the case where
 * the current user created the order (which also arrives via the mutation result)
 * and then immediately sees it again through the subscription.
 */
@Component({
  selector: 'app-order-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatChipsModule,
    CurrencyPipe,
    PageHeader,
    Loading,
    EmptyState,
    ErrorBanner,
  ],
  templateUrl: './order-list.page.html',
  styleUrl: './order-list.page.scss',
})
export class OrderListPage implements OnInit {
  // inject() replaces constructor injection in Angular 21
  private readonly ordersService = inject(Orders);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly notification = inject(Notification);

  readonly orders = signal<OrderFieldsFragment[]>([]);
  readonly loading = signal(true);
  readonly error = signal<AppError | null>(null);
  readonly totalElements = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  /**
   * Currently selected customer ID used as the filter for the orders query.
   *
   * null means "all orders". Updated by onCustomerChange() and passed to
   * the watchOrders QueryRef variables via refetch().
   */
  readonly selectedCustomerId = signal<string | null>(null);

  /**
   * Customer options for the filter MatSelect.
   *
   * Loaded from OrdersService.watchCustomerOptions() in ngOnInit. Using a signal
   * means the template re-renders automatically when the options arrive.
   */
  readonly customerOptions = signal<GetCustomerOptionsQuery['customers']['content']>([]);

  /**
   * WebSocket connection status for the orderCreated subscription.
   *
   * 'connected' is the default; flips to 'disconnected' when the subscription
   * observable errors (e.g. WebSocket closed unexpectedly). A discreet chip in
   * the template surfaces this state without blocking the main list view.
   */
  readonly liveStatus = signal<'connected' | 'disconnected'>('connected');

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly displayedColumns = ['id', 'customer', 'product', 'quantity', 'total', 'actions'];

  // DestroyRef is injected to pass to takeUntilDestroyed() in ngOnInit,
  // where the injection context is no longer active.
  private readonly destroyRef = inject(DestroyRef);

  private readonly queryRef = this.ordersService.watchOrders(null, 0, DEFAULT_PAGE_SIZE);
  private readonly customerOptionsRef = this.ordersService.watchCustomerOptions();

  /**
   * Subscribes to the orders watchQuery, the customer options, and the
   * orderCreated subscription on init.
   *
   * takeUntilDestroyed(destroyRef) is the Angular 16+ idiom for cleaning up
   * long-lived subscriptions. It completes the observable when the component
   * is destroyed, preventing memory leaks.
   */
  ngOnInit(): void {
    // Main paginated list
    this.queryRef.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
        if (result.error) {
          this.error.set(mapError(result.error as Error));
        } else {
          this.error.set(null);
          if (result.data?.orders) {
            // With errorPolicy:'all', Apollo v4 types data as MaybeDeepPartial.
            // At this point there are no errors so data is complete; assert the full type.
            this.orders.set([...(result.data.orders.content as OrderFieldsFragment[])]);
            this.totalElements.set(result.data.orders.totalElements ?? 0);
          }
        }
      },
    });

    // Customer options for the filter select
    this.customerOptionsRef.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (result.data?.customers?.content) {
            this.customerOptions.set(
              result.data.customers.content as GetCustomerOptionsQuery['customers']['content'],
            );
          }
        },
      });

    // Real-time orderCreated subscription -- uses the WebSocket link
    this.ordersService
      .subscribeToOrderCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          // Mark the WebSocket as healthy on each successful event
          this.liveStatus.set('connected');
          const newOrder = result.data?.orderCreated;
          if (!newOrder) {
            return;
          }
          // Deduplicate: the current user's order arrives both from the mutation
          // result (already prepended below in openCreateDialog) and from the
          // subscription. Check by id to prevent inserting the same order twice.
          const alreadyPresent = this.orders().some((o) => o.id === newOrder.id);
          if (!alreadyPresent) {
            // Prepend the new order so it appears at the top without a refetch
            this.orders.set([newOrder as OrderFieldsFragment, ...this.orders()]);
            this.totalElements.set(this.totalElements() + 1);
          }
          // Notify regardless of dedup -- the user wants to know a new order landed
          this.notification.info(`New order #${newOrder.id}`);
        },
        error: () => {
          // WebSocket dropped or subscription error -- surface the discreet indicator
          this.liveStatus.set('disconnected');
        },
      });
  }

  /**
   * Handles Material paginator page events.
   *
   * Updates the local page signals and calls refetch() with the new variables,
   * preserving the active customer filter.
   *
   * @param event - The paginator page event containing pageIndex and pageSize.
   */
  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    void this.queryRef.refetch({
      customerId: this.selectedCustomerId(),
      page: event.pageIndex,
      size: event.pageSize,
    });
  }

  /**
   * Handles customer filter changes from the MatSelect.
   *
   * Resets pageIndex to 0 when the filter changes so the user always sees
   * the first page of results for the new customer, not a stale offset.
   *
   * @param customerId - The selected customer ID, or null to show all orders.
   */
  onCustomerChange(customerId: string | null): void {
    this.selectedCustomerId.set(customerId);
    this.pageIndex.set(0);
    void this.queryRef.refetch({
      customerId,
      page: 0,
      size: this.pageSize(),
    });
  }

  /**
   * Retries the order list query after a fetch error.
   *
   * Called by the ErrorBanner component's retry button.
   */
  retryLoad(): void {
    void this.queryRef.refetch();
  }

  /**
   * Opens the create-order dialog.
   *
   * On dialog close with a truthy result (the saved order), prepends it to the
   * local orders signal immediately for instant feedback. The subscription may
   * also deliver the same order; the deduplication guard in the subscription
   * handler ensures it is not inserted twice.
   */
  openCreateDialog(): void {
    this.dialog
      .open(OrderFormDialog, { width: '520px' })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe((result: OrderFormDialogResult) => {
        // Prepend the newly created order to give instant visual feedback.
        // The subscription will also deliver this order; the dedup guard will skip it.
        const alreadyPresent = this.orders().some((o) => o.id === result.id);
        if (!alreadyPresent) {
          this.orders.set([result, ...this.orders()]);
          this.totalElements.set(this.totalElements() + 1);
        }
      });
  }

  /**
   * Navigates to the order detail page for the given order.
   *
   * @param order - The order whose detail page to open.
   */
  viewOrder(order: OrderFieldsFragment): void {
    void this.router.navigate(['/orders', order.id]);
  }
}
