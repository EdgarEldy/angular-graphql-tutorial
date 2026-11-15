# Architecture

Understanding the overall structure before diving into code prevents confusion about where
to put things and why the layers are separated the way they are.

---

## The request flow

Every piece of data that the application displays travels through the same pipeline:

```
Component
  |
  | calls a method on
  v
Feature Service  (src/app/features/<name>/data/<name>.ts)
  |
  | calls Apollo.query() / .mutate() / .watchQuery()
  v
Apollo link chain  (src/app/core/graphql/apollo.config.ts)
  |
  +-- authInterceptor  adds "Authorization: Bearer <token>" to every HTTP request
  |
  +-- errorLink        catches GraphQL errors and network failures, maps them to AppError
  |
  +-- split()          routes subscriptions to GraphQLWsLink, everything else to HttpLink
  |
  v
Spring GraphQL backend  (POST http://localhost:8080/graphql  or  WS ws://localhost:8080/graphql)
```

**Why this layering?**

- The **component** only knows its feature service. It never imports Apollo directly. This
  means you can test a component by providing a simple service mock -- no Apollo needed.
- The **feature service** owns the GraphQL documents for one resource (categories, products,
  etc.) and translates Apollo responses into typed domain objects. It never touches the UI.
- The **link chain** is cross-cutting infrastructure: authentication, error normalisation,
  and transport selection happen once, in one place, for every operation in the app.

---

## Folder structure

```
src/app/
├── app.ts                   Root component -- just a <router-outlet>
├── app.config.ts            Bootstrap providers: router, HttpClient, Apollo, APP_INITIALIZER
├── app.routes.ts            Top-level lazy routes, one loadChildren per feature
│
├── core/                    Infrastructure -- singleton, never feature-specific
│   ├── graphql/
│   │   ├── apollo.config.ts         Builds and exports the Apollo client
│   │   ├── error-mapper.ts          Converts raw Apollo errors to AppError
│   │   ├── ws-client.ts             Creates the WebSocket client (subscriptions)
│   │   └── generated/
│   │       └── graphql.ts           GENERATED -- do not edit by hand
│   ├── auth/
│   │   ├── auth.ts                  Token read/write in localStorage, raw signals
│   │   ├── auth.service.ts          Session management (login, logout, restoreSession)
│   │   ├── auth.guard.ts            Redirects unauthenticated users to /auth/login
│   │   ├── admin-guard.ts           Redirects non-admins to /dashboard
│   │   └── auth-interceptor.ts      Injects the Bearer token into every HttpClient request
│   ├── notification/
│   │   └── notification.ts          Wraps MatSnackBar: success() and error() methods
│   └── layout/
│       └── shell/                   Persistent app chrome: toolbar, sidenav, router-outlet
│
├── shared/                  Reusable UI -- not tied to any domain
│   ├── ui/
│   │   ├── confirm-dialog/          "Are you sure?" used by every delete action
│   │   ├── page-header/             Title + optional action button at the top of a page
│   │   ├── empty-state/             Illustrated placeholder when a list has no results
│   │   ├── loading/                 Spinner shown while data is being fetched
│   │   └── error-banner/            Error message + Retry button, shown when a query fails
│   └── pagination/
│       └── paginator-adapter.ts     Converts Material's PageEvent to backend page/size params
│
└── features/                One folder per business domain
    ├── auth/                Login, register, activate, forgot/reset, profile
    ├── users/               User administration (admin only)
    ├── roles/               Role administration + permission list (admin only)
    ├── categories/          Category CRUD
    ├── products/            Product CRUD with filters
    ├── customers/           Customer CRUD + customer detail
    └── orders/              Order CRUD + live subscription
```

Each feature folder always has the same internal layout:

```
features/<name>/
  <name>.routes.ts       Lazy-loaded routes for this domain
  data/
    <name>.graphql       GraphQL documents (queries, mutations, fragments, subscriptions)
    <name>.ts            Apollo service: one method per operation, no UI logic
    <name>.spec.ts       Unit tests for the service
  pages/                 Routed smart components (fetch data, hold state, open dialogs)
  dialogs/               Create/edit forms opened with MatDialog
  components/            Presentational (dumb) components, no service injection
```

---

## Key design decisions

### Smart components vs. dumb components

**Pages** are smart: they inject the feature service, hold loading/error/empty signals, and
orchestrate dialogs. **Dialog and presentational components** are dumb: they receive data
via `input()` and communicate back via `output()`. This separation means you can test a
dialog by simply providing an input -- no service, no router, no Apollo.

### Services never touch the UI

A feature service (`categories.ts`, `products.ts`, etc.) returns `Observable` values. It
never calls `MatSnackBar`, never calls `Router.navigate()`, and never opens a `MatDialog`.
Those are UI decisions that belong in the component. This rule keeps services simple to
test: a `TestBed` with `provideHttpClient` is enough.

### Components never inject Apollo directly

A component that injects `Apollo` becomes hard to test and breaks the convention that Apollo
is an implementation detail of the service layer. Every component calls its feature service
method instead. The only place that imports from `@apollo/client` or `apollo-angular` is
the service itself (and `apollo.config.ts`).

### APP_INITIALIZER for session restore

`app.config.ts` registers an `APP_INITIALIZER` factory that calls
`AuthService.restoreSession()`. Angular runs every `APP_INITIALIZER` and waits for it to
complete before it processes the first router navigation. This guarantees that every route
guard (`authGuard`, `adminGuard`) sees the real session state from the very first request,
not a brief null flash that would redirect a logged-in user to the login page on reload.

### Generated types as the single source of truth

`schema/schema.graphqls` is a copy of the backend schema (download it with
`npm run schema:update`). `codegen.ts` reads that file and every `*.graphql` document in
`src/` and writes `src/app/core/graphql/generated/graphql.ts`. That file contains:

- TypeScript interfaces for every GraphQL type (`User`, `Product`, `Order`, etc.)
- Typed document nodes for every query, mutation, and subscription
- Enums and input types

The generated file is committed to git so that CI builds and fresh clones do not need the
backend running. Never edit it by hand; run `npm run codegen` after any schema or document
change.

### Lazy loading for every feature

Each feature is loaded only when the user navigates to it. The `app.routes.ts` file uses
`loadChildren` for every route. This keeps the initial bundle small and means that an ADMIN
user who never visits `/categories` never downloads the categories code.
