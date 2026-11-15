# Branch: feature/products

Builds on `feature/categories`. Introduces multi-filter queries and reuses the
`CategoryOptions` service from the previous branch.

---

## What you will learn

- How to pass multiple optional filters to a GraphQL query
- How to handle different input types (text search, number range, select)
- How to omit `null` or `undefined` variables so the backend ignores them
- How to reuse a query from another feature (`CategoryOptions`)
- How `ProductFields` embeds a nested `CategoryFields` fragment to avoid a second request

---

## Screens

### Product list (`/products`)

A paginated table with four columns: product name, category, unit price (formatted with the
currency pipe), and admin action buttons.

Above the table, a filter bar with four independent controls:

| Control | Variable | Trigger | Resets page? |
|---|---|---|---|
| Category select | `categoryId` | On selection change | Yes |
| Product name | `productName` | On each keystroke (`input` event) | Yes |
| Min price | `minPrice` | On blur (`change` event) | No |
| Max price | `maxPrice` | On blur (`change` event) | No |

**Why is name filtered on every keystroke but price filtered on blur?**  
Typing a name character by character produces reasonable intermediate results ("Ap" ->
"Apple juice", "Apple c" -> "Apple cider"). Typing a price character by character does not:
"$" or "$1" with max price "$100" produces noisy results. Triggering price filter on blur
(when the user leaves the field) sends one clean request per entered value.

**Omitting empty filters:**  
When a filter control is empty or null, the variable is omitted entirely from the query
variables object. The backend interprets an absent variable as "no filter on this field":

```typescript
// In the service:
variables: {
  page, size,
  ...(categoryId ? { categoryId } : {}),
  ...(productName ? { productName } : {}),
  ...(minPrice !== null ? { minPrice } : {}),
  ...(maxPrice !== null ? { maxPrice } : {}),
}
```

### Create / Edit dialog (`ProductFormDialog`)

Fields: `productName` (required), `unitPrice` (required, must be > 0), `categoryId`
(required, `mat-select` populated from `CategoryOptions`).

`unitPrice` is a `Float` in GraphQL. The form control holds a `number`. The input accepts
decimal values. The value is displayed with `{{ product.unitPrice | currency }}` in the
table.

---

## Nested fragment: CategoryFields inside ProductFields

`ProductFields` includes the category as a nested selection:

```graphql
fragment ProductFields on Product {
  id
  productName
  unitPrice
  category { ...CategoryFields }  # nested fragment
}
```

This means the product list query returns both the product data and the full category name
in a single request. No second query is needed to look up the category for each row.

Apollo normalises the category by its own `id`. If the same category appears in both the
product list and the category list, they share the same cached entry and updates to the
category name propagate to both views.

---

## Cache updates

Same strategy as categories:

| Operation | Cache strategy |
|---|---|
| Create | `refetchQueries: ['GetProducts']` |
| Update | Automatic (Apollo updates by `id`) |
| Delete | `cache.evict + cache.gc` |

---

## Key files

| File | Purpose |
|---|---|
| `src/app/features/products/data/products.graphql` | ProductFields fragment, CRUD operations |
| `src/app/features/products/data/products.ts` | Products feature service |
| `src/app/features/products/pages/product-list/` | Paginated list page with filter bar |
| `src/app/features/products/dialogs/product-form/` | Create/edit dialog |
| `src/app/features/products/products.routes.ts` | Lazy route: `/products` |
