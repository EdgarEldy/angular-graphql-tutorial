# Branch: feature/orders

The final feature branch. Builds on `feature/customers`. Introduces GraphQL subscriptions
(real-time updates), dynamic form arrays (order items), and a distinction between
client-side total preview and server-authoritative total.

---

## What you will learn

- How to implement a GraphQL subscription with `graphql-ws` and `takeUntilDestroyed()`
- How to deduplicate subscription events (avoid counting your own newly created orders)
- How to handle order items as a dynamic form array (add/remove rows at runtime)
- Why the client-side total is a preview only and when to show each one
- How to colour-code a status chip with Angular Material and CSS classes

---

## Screens

### Order list (`/orders`)

Paginated table with columns: order number, customer name, status chip, creation date, total.

A live badge above the table counts orders that arrived via subscription since the last page
load. Clicking the badge calls `refetch()` on the list query and resets the counter.

Admin actions: "New order" in the page header, "Edit" and "Delete" per row. Clicking a row
navigates to `/orders/:id`.

### Order detail (`/orders/:id`)

Read-only view with two sections:

1. **Order info card** -- order number, status chip, creation date, customer name and email.
2. **Items table** -- product name, quantity, unit price, line total (quantity × unit price).
   Below the table: "Grand total" sourced from `order.total` (server-computed).

> The grand total shown in the detail view comes from the `total` field in the GraphQL
> response, which the backend calculates. Never compute it on the client for display in the
> detail view; use the server value.

### Create / Edit dialog (`OrderFormDialog`)

Fields:

- `customerId` (required, `mat-select` populated from a customer list)
- `status` (required, `mat-select` with the `OrderStatus` enum values)
- **Order items** (dynamic list): each row has `productId` (required, `mat-select`) and
  `quantity` (required, integer >= 1). Unit price is read-only, fetched when the product is
  selected and shown as a reference.

Buttons on the items section: **Add item** (appends a new row) and **Remove** per row.

A client-side total preview is computed as the user builds the order:
```
Estimated total = sum of (quantity × unitPrice) for all items
```

This preview is clearly labelled "Estimated total" and may differ from the server total
(which may apply discounts, taxes, or rounding rules). It is there to give the user a rough
idea before saving.

---

## The `orderCreated` subscription

The `orderCreated` subscription receives a notification whenever any user creates a new
order. The order list page subscribes while it is active and unsubscribes when the user
navigates away.

```graphql
subscription OrderCreated {
  orderCreated { ...OrderFields }
}
```

**How it is consumed:**

```typescript
ngOnInit(): void {
  this.ordersService.watchOrderCreated()
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(newOrder => {
      // Check if this order is already in the cache (the current user just created it)
      if (!this.isAlreadyInCache(newOrder.id)) {
        this.newOrderCount.update(n => n + 1);
      }
    });
}
```

**Why not update the list automatically on each subscription event?**  
Injecting a new row into the middle of a paginated table on every incoming event would cause
the table to jump around while the user is reading it. Instead, the counter badge tells the
user that new data is available, and they can choose when to refresh.

**Deduplication:**  
When the current user creates an order, the mutation response has already added it to the
cache. The `orderCreated` subscription will also fire for the same order a moment later.
Without deduplication, the badge would increment even for the user's own orders. The
component checks `cache.readFragment()` for the incoming `id` before incrementing.

---

## Status chip colours

Order status is an enum with five values. Each value maps to a visual style:

| Status | Colour | Implementation |
|---|---|---|
| `PENDING` | Amber | `color="warn"` on `mat-chip` |
| `CONFIRMED` | Blue | `color="primary"` |
| `SHIPPED` | Teal | `color="accent"` |
| `DELIVERED` | Green | Custom CSS class `.status-delivered` |
| `CANCELLED` | Grey | `color=""` (default) |

Angular Material does not have a built-in "success" (green) theme colour, so `DELIVERED`
uses a custom class defined in the component SCSS.

---

## Cache updates

| Operation | Cache strategy |
|---|---|
| Create | `refetchQueries: ['GetOrders']` to keep pagination correct |
| Update | Automatic (Apollo updates by `id`) |
| Delete | `cache.evict + cache.gc` |

---

## Key files

| File | Purpose |
|---|---|
| `src/app/features/orders/data/orders.graphql` | OrderFields, CRUD ops, `orderCreated` subscription |
| `src/app/features/orders/data/orders.ts` | Orders feature service |
| `src/app/features/orders/pages/order-list/` | List page with live badge |
| `src/app/features/orders/pages/order-detail/` | Detail page with items table |
| `src/app/features/orders/dialogs/order-form/` | Create/edit dialog with dynamic items |
| `src/app/features/orders/orders.routes.ts` | Lazy routes: `/orders`, `/orders/:id` |
