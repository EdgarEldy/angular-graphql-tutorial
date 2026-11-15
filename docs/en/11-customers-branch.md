# Branch: feature/customers

Builds on `feature/products`. Introduces two-level navigation (list -> detail) and a nested
paginated sub-list (a customer's orders inside the customer detail page).

---

## What you will learn

- How to build a master/detail navigation with two routes (`/customers` and `/customers/:id`)
- How to fetch a nested paginated collection inside a detail query
- How to manage two independent page/size signal pairs on the same screen
- How the `BUSINESS_RULE` error on delete is different from a system error

---

## Screens

### Customer list (`/customers`)

Paginated table with columns: full name, email, phone. A name search input above the table
filters by `customerName` (fires on each keystroke, resets to page 0).

Admin actions: "New customer" in the page header, "Edit" and "Delete" per row.

Clicking a row's name navigates to `/customers/:id`.

### Customer detail (`/customers/:id`)

A read-only view with two sections:

1. **Customer info card** -- full name, email, phone, address, account status.
2. **Orders sub-table** -- a paginated `MatTable` of that customer's orders, with columns:
   order number, status chip, date, total. This sub-table has its own independent page and
   size signals; navigating its pages does not affect the outer customers list.

The detail query fetches both the customer fields and the first page of their orders in a
single request:

```graphql
query GetCustomer($id: ID!, $page: Int, $size: Int) {
  customer(id: $id) {
    ...CustomerFields
    orders(page: $page, size: $size) {
      content { ...OrderSummaryFields }
      totalElements
      totalPages
    }
  }
}
```

When the user navigates the sub-table, the page component calls `fetchMore()` on the
existing query and merges the result into the cache.

### Create / Edit dialog (`CustomerFormDialog`)

Fields: `firstName` (required), `lastName` (required), `email` (required, email validator),
`phone` (optional), `address` (optional).

---

## Two independent pagination states

The detail page manages two separate sets of pagination signals:

```typescript
// For the outer customers list (preserved in the URL query params for back navigation)
customerPage = signal(0);
customerSize = signal(10);

// For the orders sub-table (local to the detail page)
ordersPage = signal(0);
ordersSize = signal(5);
```

Changing `ordersPage` triggers a `fetchMore` on the customer query -- it re-runs the query
with the new `page` variable and Apollo merges the result into the existing customer entry.

---

## Business rule: delete blocked

Attempting to delete a customer who has orders returns a `BUSINESS_RULE` error
(`422 Unprocessable Entity`) from the backend. The message is something like:
"Customer cannot be deleted because they have existing orders."

The UI shows this message verbatim in an error snackbar and the row stays in the table.
The user must delete or reassign the orders before deleting the customer.

This is different from a `SERVER` error (which means something went wrong unexpectedly):
a `BUSINESS_RULE` error is a deliberate constraint the backend enforces, and the message
is meaningful to the user.

---

## Cache updates

| Operation | Cache strategy |
|---|---|
| Create | `refetchQueries: ['GetCustomers']` |
| Update | Automatic (Apollo updates by `id`) |
| Delete | `cache.evict + cache.gc` |

---

## Key files

| File | Purpose |
|---|---|
| `src/app/features/customers/data/customers.graphql` | CustomerFields, OrderSummaryFields, CRUD |
| `src/app/features/customers/data/customers.ts` | Customers feature service |
| `src/app/features/customers/pages/customer-list/` | Paginated list with name filter |
| `src/app/features/customers/pages/customer-detail/` | Detail page with orders sub-table |
| `src/app/features/customers/dialogs/customer-form/` | Create/edit dialog |
| `src/app/features/customers/customers.routes.ts` | Lazy routes: `/customers`, `/customers/:id` |
