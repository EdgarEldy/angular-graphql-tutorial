# Branch: feature/categories

This is the first full CRUD feature branch. It establishes the patterns that products,
customers, and orders all repeat. If you understand how categories work, you understand how
every other list feature works.

---

## What you will learn

- The standard CRUD pattern for a paginated list (query, create, update, delete)
- How to open a `MatDialog` and pass data to it
- How to update the Apollo cache after create, update and delete mutations
- How to handle a `BUSINESS_RULE` error (delete blocked by the backend)
- How to share a query across features with `CategoryOptions`

---

## Screens

### Category list (`/categories`)

A paginated `MatTable` with one column: `categoryName`. Pagination controls at the bottom
using Angular Material's paginator.

**What admins see:** a "New category" button in the page header, and "Edit" and "Delete"
icon buttons on each row. These are hidden from non-admin users via the `*appHasRole`
directive.

**What non-admin users see:** the table only, read-only.

### Create / Edit dialog (`CategoryFormDialog`)

A `MatDialog` with a single form field: `categoryName` (required, `mat-form-field
appearance="outline"`). The same dialog is used for both create (no initial data) and edit
(pre-filled with the row's `categoryName`).

The parent page detects which case applies by checking whether `MatDialogRef.close()` was
called with an entity. If it was, it refetches the list (for create) or the cache updates
automatically (for edit).

---

## Operations and their cache behaviour

| Operation | GraphQL document | Cache after mutation |
|---|---|---|
| List | `GetCategories(page, size)` | (read-only) |
| Create | `CreateCategory(input)` | `refetchQueries: ['GetCategories']` -- re-fetches page 0 |
| Update | `UpdateCategory(id, input)` | Automatic (Apollo updates by `id`) |
| Delete | `DeleteCategory(id)` | `cache.evict + cache.gc` |

**Why is create handled with `refetchQueries` and not `cache.modify`?**  
When a new entity is created, the total count changes and the new entity might appear on a
different page depending on the sort order. It is simpler and safer to refetch page 0 than
to try to insert the new item into the right position in the cache.

**Why does update work automatically?**  
Apollo normalises every object in the cache by `__typename + id`. When an `UpdateCategory`
mutation returns a `CategoryFields` fragment with the same `id`, Apollo merges the new field
values into the cached entry. Any query that includes that category will immediately return
the updated value without an extra network request.

---

## Business rule: delete blocked

Deleting a category that still has products returns a `BAD_REQUEST` error from the backend.
The error message explains which constraint was violated (e.g. "Cannot delete a category
that has products"). The page shows this message verbatim in an error snackbar -- never
replace it with a generic "Delete failed" message, because the backend message tells the
user exactly what to do (remove the products first).

---

## CategoryOptions service

`src/app/features/categories/data/category-options.ts` is a separate service that runs a
simplified `GetCategories` query with no pagination (fetches all categories at once). It is
used by the **products** feature for two purposes:

1. The category filter dropdown on the product list page.
2. The category select in the product create/edit dialog.

Keeping it as a separate service rather than a method on `CategoriesService` avoids a
circular dependency: `products` imports from `categories`, but `categories` should never
import from `products`.

---

## Key files

| File | Purpose |
|---|---|
| `src/app/features/categories/data/categories.graphql` | CategoryFields fragment, CRUD operations |
| `src/app/features/categories/data/categories.ts` | Categories feature service |
| `src/app/features/categories/data/category-options.ts` | Shared query for category selects |
| `src/app/features/categories/pages/category-list/` | Paginated list page |
| `src/app/features/categories/dialogs/category-form/` | Create/edit dialog |
| `src/app/features/categories/categories.routes.ts` | Lazy route: `/categories` |
