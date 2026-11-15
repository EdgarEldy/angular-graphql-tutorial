# Error handling

Error handling in GraphQL is different from REST. In REST, an error always means an HTTP
status code >= 400. In GraphQL, the server always returns HTTP 200, even when something went
wrong -- the errors are inside the response body, in an `errors` array alongside the `data`
field. This project normalises both GraphQL errors and network errors into a single type so
components never need to know which kind they received.

---

## The AppError type

Every error in the application is represented as an `AppError`:

```typescript
interface AppError {
  kind: ErrorKind;   // what kind of problem it is
  status: number;    // the HTTP status code (0 for network errors)
  message: string;   // the user-facing message from the backend
  fieldErrors?: Record<string, string[]>; // validation errors per field (kind VALIDATION)
}

type ErrorKind =
  | 'VALIDATION'      // 400 -- invalid input, fieldErrors populated
  | 'UNAUTHENTICATED' // 401 -- token missing or expired
  | 'FORBIDDEN'       // 403 -- authenticated but not authorised
  | 'NOT_FOUND'       // 404 -- entity does not exist
  | 'CONFLICT'        // 409 -- duplicate name, etc.
  | 'BUSINESS_RULE'   // 422 -- domain constraint (delete a category with products, etc.)
  | 'SERVER'          // 5xx -- unexpected server error
  | 'NETWORK';        // 0   -- could not reach the server
```

---

## The error mapper (`error-mapper.ts`)

`src/app/core/graphql/error-mapper.ts` converts a raw Apollo error into an `AppError`. Apollo
v4 wraps errors in a `CombinedError` object; the mapper inspects it:

```
CombinedError
  |
  +-- has graphQLErrors?   -> read extensions.classification + extensions.status
  |                           message comes from error.message
  +-- has networkError?    -> if ServerError, read status and body
  |                           if no response (offline), status = 0 -> NETWORK
  +-- plain Error          -> NETWORK
```

The `classification` field in `extensions` is set by the backend's Spring for GraphQL error
handling and maps directly to the `ErrorKind`:

| Backend classification | AppError kind |
|---|---|
| `BAD_REQUEST` | `VALIDATION` (400) |
| `UNAUTHORIZED` | `UNAUTHENTICATED` (401) |
| `FORBIDDEN` | `FORBIDDEN` (403) |
| `NOT_FOUND` | `NOT_FOUND` (404) |
| `CONFLICT` | `CONFLICT` (409) |
| `BUSINESS_RULE` | `BUSINESS_RULE` (422) |
| `INTERNAL_ERROR` | `SERVER` (500) |
| (no response) | `NETWORK` (0) |

---

## The error link

The error link sits at the beginning of the Apollo link chain. It intercepts every error
before it reaches the calling service and converts it:

```typescript
// apollo.config.ts (simplified)
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  const appError = mapToAppError(graphQLErrors, networkError);
  operation.setContext({ appError });
  return forward(operation);
});
```

Services receive the `AppError` from the operation context and re-throw it as a typed
observable error so components can handle it in a `.subscribe({ error: ... })` or with
`catchError`.

---

## Per-kind UI behaviour

Each `ErrorKind` has a standard UI response. This consistency is important: a student should
always know what happens when a 403 arrives, regardless of which screen they are on.

| Kind | UI response |
|---|---|
| `VALIDATION` | Show `fieldErrors` inline on the form field that caused the error |
| `UNAUTHENTICATED` | Clear the session, redirect to `/auth/login?returnUrl=<current>` |
| `FORBIDDEN` | Show the backend message in a snackbar (error colour) |
| `NOT_FOUND` | Show the error banner with a Retry button |
| `CONFLICT` | Show the backend message inline in the dialog, keep the dialog open |
| `BUSINESS_RULE` | Show the backend message inline in the dialog, keep the dialog open |
| `SERVER` | Show the error banner with a Retry button |
| `NETWORK` | Show the error banner with a Retry button |

**Exception:** a 401 from `POST /auth/login` is shown inline in the form (wrong
credentials), not as a redirect. The service detects this case by checking the operation
name before triggering the redirect.

---

## The three-state pattern

Every list and detail page has exactly three explicit states. Using Angular signals:

```typescript
loading  = signal(false);
error    = signal<AppError | null>(null);
items    = signal<Item[]>([]);
```

The template uses `@if` to show the right state:

```html
@if (loading()) {
  <app-loading />
} @else if (error()) {
  <app-error-banner [error]="error()!" (retry)="load()" />
} @else if (items().length === 0) {
  <app-empty-state message="No items found." />
} @else {
  <!-- the actual table -->
}
```

This pattern eliminates the common mistake of showing a blank screen when a query fails or
returns no results. Every screen has an explicit state for each outcome.

---

## Partial responses

When `errorPolicy: 'all'` is set on a query, Apollo delivers both `data` and `errors` to
the subscriber. The service logs the errors (for debugging) and returns the partial data to
the component. The component shows what it has and displays the error banner below it.
This is better than showing nothing when only part of a complex query fails.
