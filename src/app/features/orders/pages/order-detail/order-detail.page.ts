import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Orders } from '../../data/orders';
import { Loading } from '../../../../shared/ui/loading/loading';
import { ErrorBanner } from '../../../../shared/ui/error-banner/error-banner';
import { mapError } from '../../../../core/graphql/error-mapper';
import type { OrderFieldsFragment } from '../../../../core/graphql/generated/graphql';
import type { AppError } from '../../../../core/graphql/app-error.model';

/**
 * Order detail page (route: /orders/:id).
 *
 * Displays a single order's full details: order ID, customer (name, email,
 * phone, address), product (name, category, unit price), quantity, and the
 * server-computed total. This page has no edit or delete actions because the
 * backend does not expose update/delete operations for orders.
 *
 * Three explicit states are managed: loading, error (with retry), and not-found
 * (when the backend returns null for the given id). The not-found state uses
 * a dedicated message rather than a generic error so the user understands that
 * the order id does not exist rather than that a network failure occurred.
 */
@Component({
  selector: 'app-order-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    CurrencyPipe,
    Loading,
    ErrorBanner,
  ],
  templateUrl: './order-detail.page.html',
  styleUrl: './order-detail.page.scss',
})
export class OrderDetailPage implements OnInit {
  // inject() replaces constructor injection in Angular 21
  private readonly ordersService = inject(Orders);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly order = signal<OrderFieldsFragment | null>(null);
  readonly loading = signal(true);
  readonly error = signal<AppError | null>(null);
  readonly notFound = signal(false);

  // DestroyRef is injected to pass to takeUntilDestroyed() in ngOnInit,
  // where the injection context is no longer active.
  private readonly destroyRef = inject(DestroyRef);

  // The queryRef is created here so it is available for retryLoad().
  // ActivatedRoute.snapshot.params is safe to access in the field initialiser
  // because Angular resolves the route before creating the component.
  // orderId is exposed (not private) so the template can reference it in the
  // not-found message: "Order #{{ orderId }} was not found."
  readonly orderId = this.route.snapshot.params['id'] as string;
  private readonly queryRef = this.ordersService.watchOrder(this.orderId);

  /**
   * Subscribes to the order watchQuery on init.
   *
   * When the backend returns null for the given id (order does not exist) the
   * notFound signal is set instead of the error signal, because NOT_FOUND is a
   * business state, not a technical failure -- a retry would produce the same
   * result.
   */
  ngOnInit(): void {
    this.queryRef.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
        if (result.error) {
          const appError = mapError(result.error as Error);
          if (appError.kind === 'NOT_FOUND') {
            // NOT_FOUND is a business state, not a retryable failure
            this.notFound.set(true);
          } else {
            this.error.set(appError);
          }
        } else {
          this.error.set(null);
          if (result.data) {
            if (result.data.order === null || result.data.order === undefined) {
              // Backend returned null -- the order does not exist
              this.notFound.set(true);
            } else {
              this.order.set(result.data.order as OrderFieldsFragment);
            }
          }
        }
      },
    });
  }

  /**
   * Retries the order query after a fetch error.
   *
   * Called by the ErrorBanner retry button. This is meaningful for transient
   * network errors; NOT_FOUND errors are handled separately.
   */
  retryLoad(): void {
    void this.queryRef.refetch();
  }

  /**
   * Navigates back to the orders list page.
   */
  goBack(): void {
    void this.router.navigate(['/orders']);
  }
}
