# Branch: feature/core-architecture

This is the first branch. It builds the technical skeleton that every subsequent branch
depends on. No business screens are implemented here; the goal is working infrastructure:
a configured Apollo client, authentication plumbing, an error handling pipeline, shared UI
components, and a Docker + CI setup.

---

## What you will learn

- How to set up Apollo Angular with a split link chain (HTTP for queries/mutations, WebSocket
  for subscriptions)
- How to wire a functional HTTP interceptor so the JWT token is attached automatically
- How GraphQL Code Generator produces TypeScript types from a schema
- How to map GraphQL errors to a typed `AppError` for consistent UI handling
- How to build a persistent app shell (toolbar, sidenav, router outlet) in Angular 21

---

## What it delivers

### Apollo client (`apollo.config.ts`)

The Apollo client is configured with three links chained together:

```
errorLink
   |
 split()
   |-- subscription --> GraphQLWsLink (ws://localhost:8080/graphql)
   |-- everything else -> HttpLink   (POST http://localhost:8080/graphql)
```

`errorLink` intercepts every error response and calls `error-mapper.ts` to convert it to
an `AppError`. It runs before the split so it catches errors from both transports.

`split()` inspects the operation at runtime. If the operation definition kind is
`subscription`, the request goes through the WebSocket link; otherwise it goes through
`HttpLink`. Because `HttpLink` uses Angular's `HttpClient` internally, the auth interceptor
already covers queries and mutations without any extra configuration.

### Auth interceptor (`auth-interceptor.ts`)

A functional interceptor registered in `app.config.ts` via
`provideHttpClient(withInterceptors([authInterceptor]))`. It reads the current access token
from `AuthService` and adds `Authorization: Bearer <token>` to every `HttpClient` request.
Because Apollo's `HttpLink` uses `HttpClient` internally, all GraphQL HTTP operations are
covered automatically.

### Code generation pipeline

```
schema/schema.graphqls       -- copy of the backend schema (committed)
src/**/*.graphql              -- GraphQL documents (queries, mutations, etc.)
       |
       v  npm run codegen
       v
src/app/core/graphql/generated/graphql.ts   -- GENERATED, do not edit by hand
```

`codegen.ts` at the project root configures this pipeline. The generated file contains typed
document nodes, TypeScript interfaces for every GraphQL type, enums, and input types. It is
committed so CI and fresh clones do not need the backend running.

`npm run schema:update` downloads the latest schema from the backend repository and
re-runs codegen. Run this whenever the backend adds or removes fields.

### Error mapper (`error-mapper.ts`)

Converts Apollo v4 errors (which use `CombinedError`) to `AppError`:

- `CombinedError` with `graphQLErrors` -> reads `extensions.classification` to determine
  `ErrorKind`
- `CombinedError` with `networkError` -> reads the HTTP status code
- Status 0 / no response -> `NETWORK`

### App shell (`core/layout/shell/`)

The shell is the persistent layout that wraps every authenticated page. It contains:

- **Toolbar** with the app title, theme toggle, and profile dropdown
- **Sidenav** with navigation items grouped by role (all users see Dashboard, Categories,
  Products, Customers, Orders; ADMIN users additionally see Users, Roles, Permissions)
- **`<router-outlet>`** where the current page renders

The Administration section visibility is controlled by the `isAdmin()` signal from
`AuthService`. The shell uses `ChangeDetectionStrategy.OnPush` and reads signals in the
template, so it re-renders only when the signal values change.

The theme toggle writes `data-theme="dark"` or `data-theme="light"` on the `<html>` element
via an `effect()`. Angular Material reads this attribute to switch colour palettes.

### Shared UI components (`shared/ui/`)

These components are used by every feature. Never duplicate their behaviour in a feature
component.

| Component | When to use |
|---|---|
| `<app-loading>` | Show while `loading()` signal is true |
| `<app-error-banner [error]="..." (retry)="...">` | Show when a query fails |
| `<app-empty-state [message]="...">` | Show when a query returns an empty list |
| `<app-page-header [title]="..." (action)="...">` | At the top of every list page |
| `<app-confirm-dialog>` | Open via `MatDialog` for every delete action |

### Notification service (`core/notification/notification.ts`)

Wraps `MatSnackBar` with two methods: `success(message)` and `error(message)`. Feature
services and pages call this service instead of injecting `MatSnackBar` directly. This keeps
the snackbar configuration (duration, horizontal/vertical position) centralised.

### Pagination adapter (`shared/pagination/`)

Converts between Angular Material's `PageEvent` (page index, page size) and the backend's
`PageResponse` envelope (page number, size, totalElements, totalPages). This keeps
pagination logic out of individual page components.

### Docker and CI

**`Dockerfile`** -- two-stage build:
1. Node 22 image: `npm ci` + `npm run build`
2. nginx image: copies `dist/`, applies `nginx.conf`

**`nginx.conf`** -- proxies `/graphql` (HTTP and WebSocket) to the backend and serves the
Angular SPA with HTML5 history fallback.

**`docker-compose.yml`** -- starts the frontend container. Expects the backend at
`host.docker.internal:8080`.

**`.github/workflows/ci.yml`** -- runs on every push and pull request: install, lint, test,
build. All four steps must pass before a PR can be merged.

---

## Key files

| File | Purpose |
|---|---|
| `src/app/app.config.ts` | Root providers (router, HttpClient, Apollo, APP_INITIALIZER) |
| `src/app/app.routes.ts` | Top-level lazy routes |
| `src/app/core/graphql/apollo.config.ts` | Apollo client setup |
| `src/app/core/graphql/error-mapper.ts` | Error normalisation |
| `src/app/core/graphql/ws-client.ts` | WebSocket client for subscriptions |
| `src/app/core/auth/auth.ts` | Token persistence |
| `src/app/core/auth/auth.service.ts` | Session management |
| `src/app/core/auth/auth-interceptor.ts` | JWT injection into HTTP requests |
| `src/app/core/layout/shell/shell.ts` | Persistent app layout |
| `schema/schema.graphqls` | Backend schema (source of truth for codegen) |
| `codegen.ts` | Code generation configuration |
