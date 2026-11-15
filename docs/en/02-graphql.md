# GraphQL and Apollo

This project uses [Apollo Angular](https://the-guild.dev/graphql/apollo-angular) as the
GraphQL client and [GraphQL Code Generator](https://the-guild.dev/graphql/codegen) to
produce TypeScript types from the schema. This document explains how the two work together
and the patterns the codebase follows.

---

## What is GraphQL?

GraphQL is a query language for APIs. Instead of multiple REST endpoints (`GET /categories`,
`GET /categories/1/products`, etc.), a GraphQL API exposes a single endpoint (`POST
/graphql`) that accepts a document describing exactly what data the client needs. The server
returns only those fields -- nothing more, nothing less.

Three kinds of documents exist:

| Kind | Purpose | HTTP transport |
|---|---|---|
| `query` | Read data | POST |
| `mutation` | Write data (create, update, delete) | POST |
| `subscription` | Receive a stream of events | WebSocket |

---

## The Apollo link chain

Apollo sends every operation through a chain of **links** before it reaches the server.
Think of links as middleware. The chain in `src/app/core/graphql/apollo.config.ts` is:

```
Every operation
      |
      v
  errorLink         Catches errors and maps them to AppError
      |
      v
   split()          Inspects the operation kind
      |             If it is a subscription -> GraphQLWsLink (WebSocket)
      |             Otherwise              -> HttpLink      (HTTP POST)
      v
  HttpLink / GraphQLWsLink
      |
      v
  Spring GraphQL backend
```

**errorLink** is an `onError` link from `@apollo/client/link/error`. It runs whenever Apollo
receives a response that contains GraphQL errors or a network-level failure. It converts the
raw error into a typed `AppError` and re-throws it so the calling service can handle it.

**split()** inspects each operation at runtime. A `subscription` definition kind goes to the
WebSocket link; everything else goes to the HTTP link. This is why queries and mutations go
through `HttpClient` (and pick up the auth interceptor automatically) while subscriptions go
through the WebSocket connection (and pass the token via `connectionParams`).

---

## Code generation

Writing GraphQL documents by hand and then duplicating the shapes in TypeScript interfaces
would create a maintenance burden and a source of type drift. Code Generator eliminates this
by reading the schema and all `*.graphql` files and producing a single TypeScript file with
everything typed.

```
schema/schema.graphqls       The backend schema (never edit by hand)
src/**/*.graphql              The GraphQL documents written for each feature
        |
        v  npm run codegen
        v
src/app/core/graphql/generated/graphql.ts
```

The generated file contains:

- **Interfaces** for every type (`UserFragment`, `ProductFragment`, etc.)
- **Typed document nodes** for every query, mutation and subscription
  (`GetCategoriesDocument`, `CreateCategoryDocument`, etc.)
- **Enums** (`OrderStatus`, `UserRole`, etc.)
- **Input types** (`CreateCategoryInput`, `UpdateProductInput`, etc.)

Always import from `graphql.ts` in your services, never define the same shape by hand.
The file is committed to git so CI runs without the backend.

**When to run codegen:**

- After creating or modifying a `*.graphql` file.
- After running `npm run schema:update` (which downloads a new schema from the backend).
- After pulling changes that modified the schema or any document.

---

## Fragments

A **fragment** is a named, reusable selection set. Instead of repeating the same list of
fields in every query and mutation, you define a fragment once and spread it everywhere.

```graphql
# Defined once in categories.graphql
fragment CategoryFields on Category {
  id
  categoryName
}

# Used in queries
query GetCategories($page: Int, $size: Int) {
  categories(page: $page, size: $size) {
    content { ...CategoryFields }
    totalElements
    totalPages
  }
}

# Used in mutations -- the response also uses the fragment
mutation CreateCategory($input: CreateCategoryInput!) {
  createCategory(input: $input) { ...CategoryFields }
}
```

This matters for the Apollo cache: Apollo normalises cached objects by `__typename + id`.
When a mutation response contains the same fragment as the query that populated the list,
Apollo recognises the returned object and updates the cached version automatically, so the
UI reflects the change without an extra fetch.

The fragments used in this project:

| Fragment | Defined in | Used for |
|---|---|---|
| `CategoryFields` | `categories.graphql` | Category list and dialogs |
| `ProductFields` | `products.graphql` | Product list and dialogs |
| `CustomerFields` | `customers.graphql` | Customer list and dialogs |
| `OrderFields` | `orders.graphql` | Order list and dialogs |
| `OrderItemFields` | `orders.graphql` | Order items table |
| `UserFragment` | `users.graphql` | User management |
| `RoleFragment` | `roles.graphql` | Role management |
| `PermissionFragment` | `roles.graphql` | Permission management |
| `AuthPayloadFields` | `auth.graphql` | Login and refresh token responses |

---

## Cache update patterns

The Apollo `InMemoryCache` stores every object it has seen, indexed by `__typename + id`.
After a mutation, the cache may be stale. The project uses two strategies:

### Automatic update (for mutations that return the modified entity)

When an `updateCategory` mutation returns a `CategoryFields` fragment, Apollo recognises the
`id` and updates the cached entry automatically. Any query that included that category in its
result now returns the updated value. No extra code is needed.

### Manual update with `cache.evict` (for deletions)

When an entity is deleted, the server returns nothing (or just the deleted id). Apollo does
not know to remove the entity from the cache. The service calls:

```typescript
cache.evict({ id: cache.identify(deletedEntity) });
cache.gc(); // garbage-collect dangling references
```

### Refetch queries (for creates where pagination matters)

When a new entity is created, the total count and page assignments change. The simplest
strategy is to refetch the list query:

```typescript
this.apollo.mutate({
  mutation: CreateCategoryDocument,
  variables: { input },
  refetchQueries: [{ query: GetCategoriesDocument, variables: { page: 0, size: 10 } }],
});
```

---

## Subscriptions and WebSocket

The `orderCreated` subscription demonstrates real-time updates. The WebSocket connection is
established by `GraphQLWsLink` using the `graphql-ws` protocol.

The token is passed at connection time via `connectionParams`:

```typescript
// ws-client.ts
connectionParams: () => {
  const token = auth.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

This means the WebSocket is authenticated. If the token expires while the connection is
open, the client calls `reconnect()` after a token refresh to re-authenticate.

In a component, subscribe and clean up with `takeUntilDestroyed()`:

```typescript
private destroyRef = inject(DestroyRef);

ngOnInit(): void {
  this.ordersService.watchOrderCreated()
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(order => this.newOrderCount.update(n => n + 1));
}
```

`takeUntilDestroyed` automatically unsubscribes when the component is destroyed, preventing
memory leaks without a manual `ngOnDestroy`.

---

## errorPolicy

Queries use `errorPolicy: 'all'` so that partial results (data + errors) are handled
gracefully. With the default `'none'`, any error in the response throws and discards the
data. With `'all'`, the service receives both and can decide whether to show the partial data
or the error.
