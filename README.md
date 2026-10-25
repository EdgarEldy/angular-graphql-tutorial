# angular-graphql-tutorial

A complete tutorial for building an **Angular 21** frontend that consumes a **GraphQL API** with **Apollo Angular**. The backend is [`spring-graphql-tutorial`](https://github.com/EdgarEldy/spring-graphql-tutorial) (Spring Boot 4.1, Spring for GraphQL, PostgreSQL), which exposes an identity/RBAC domain and an e-commerce domain behind a single GraphQL schema.

This document is the **complete specification** of the project. It is written to be followed step by step, branch by branch. Read it fully before writing any code.

## Table of contents

- [Backend contract](#backend-contract)
- [Tech stack](#tech-stack)
- [Branching strategy](#branching-strategy)
- [Project structure](#project-structure)
- [GraphQL conventions on the frontend](#graphql-conventions-on-the-frontend)
- [Authentication and authorization](#authentication-and-authorization)
- [Error handling](#error-handling)
- [Testing strategy](#testing-strategy)
- [feature/core-architecture](#featurecore-architecture)
- [feature/auth](#featureauth)
- [feature/categories](#featurecategories)
- [feature/products](#featureproducts)
- [feature/customers](#featurecustomers)
- [feature/orders](#featureorders)
- [Order of work](#order-of-work)
- [Generate with the Angular CLI](#generate-with-the-angular-cli)
- [Code conventions](#code-conventions)
- [Concepts covered](#concepts-covered)
- [How to follow this tutorial](#how-to-follow-this-tutorial)

## Backend contract

| Item                  | Value                                                                                     |
|-----------------------|-------------------------------------------------------------------------------------------|
| Base URL (dev)        | `http://localhost:8080`                                                                   |
| GraphQL over HTTP     | `POST /graphql` (single endpoint; queries and mutations)                                  |
| GraphQL subscriptions | WebSocket on `/graphql` (`spring.graphql.websocket.path`), `graphql-ws` protocol          |
| GraphiQL              | `GET /graphiql` (dev profile only)                                                        |
| Authentication        | JWT in the `Authorization: Bearer <token>` header; lifetime 1 hour (`jwt.expiration-ms`)  |
| Transport status      | Always `200 OK`: success and failure both live in the response body (`data` / `errors`)   |
| Error classification  | `errors[].extensions.classification`: `NOT_FOUND`, `BAD_REQUEST`, `FORBIDDEN`, `INTERNAL_ERROR` |

The backend has **two independent domains** sharing one schema and one database, with **no link between them**: a `Customer` is a standalone record and never resolves to a `User`. Do not model a relation between the two on the frontend.

### Schema summary

Reproduced from `src/main/resources/graphql/schema.graphqls` of the backend. In case of doubt, re-read the real file.

**Queries**

| Operation                                                    | Returns            | Access (per backend spec)  |
|--------------------------------------------------------------|--------------------|----------------------------|
| `me`                                                         | `User` (nullable)  | Authenticated              |
| `users(page: Int, size: Int)`                                | `UserPage!`        | ADMIN                      |
| `user(id: ID!)`                                              | `User`             | ADMIN                      |
| `roles`                                                      | `[Role!]!`         | ADMIN                      |
| `role(id: ID!)`                                              | `Role`             | ADMIN                      |
| `permissions`                                                | `[Permission!]!`   | ADMIN                      |
| `categories(page: Int, size: Int)`                           | `CategoryPage!`    | Enforced by the backend    |
| `category(id: ID!)`                                          | `Category`         | Enforced by the backend    |
| `products(categoryId: ID, page: Int, size: Int)`             | `ProductPage!`     | Enforced by the backend    |
| `product(id: ID!)`                                           | `Product`          | Enforced by the backend    |
| `customers(page: Int, size: Int)`                            | `CustomerPage!`    | Enforced by the backend    |
| `customer(id: ID!)`                                          | `Customer`         | Enforced by the backend    |
| `orders(customerId: ID, page: Int, size: Int)`               | `OrderPage!`       | Enforced by the backend    |
| `order(id: ID!)`                                             | `Order`            | Enforced by the backend    |

**Mutations**

| Group      | Operations                                                                                                                                                                                                 |
|------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Auth       | `register(input: RegisterInput!)`, `activateAccount(token: String!)`, `login(input: LoginInput!)`, `logout`, `requestPasswordReset(email: String!)`, `resetPassword(token: String!, newPassword: String!)` |
| Users      | `createUser(input: CreateUserInput!)`, `updateUser(id: ID!, input: UpdateUserInput!)`, `lockUser(id: ID!)`, `unlockUser(id: ID!)`, `deleteUser(id: ID!)`, `assignRoleToUser(userId: ID!, roleId: ID!)`, `removeRoleFromUser(userId: ID!, roleId: ID!)` |
| Roles      | `createRole(input: RoleInput!)`, `updateRole(id: ID!, input: RoleInput!)`, `deleteRole(id: ID!)`, `createPermission(input: PermissionInput!)`, `deletePermission(id: ID!)`, `assignPermissionToRole(roleId: ID!, permissionId: ID!)`, `removePermissionFromRole(roleId: ID!, permissionId: ID!)` |
| Categories | `createCategory(input: CategoryInput!)`, `updateCategory(id: ID!, input: CategoryInput!)`, `deleteCategory(id: ID!)`                                                                                         |
| Products   | `createProduct(input: ProductInput!)`, `updateProduct(id: ID!, input: ProductInput!)`, `deleteProduct(id: ID!)`                                                                                              |
| Customers  | `createCustomer(input: CustomerInput!)`, `updateCustomer(id: ID!, input: CustomerInput!)`, `deleteCustomer(id: ID!)`                                                                                         |
| Orders     | `createOrder(input: OrderInput!)`                                                                                                                                                                            |

**Subscriptions**: `orderCreated: Order!`

**Types and inputs**

```graphql
type User         { id: ID!  firstName: String!  lastName: String!  email: String!
                    enabled: Boolean!  accountLocked: Boolean!  roles: [Role!]! }
type Role         { id: ID!  roleName: String!  permissions: [Permission!]! }
type Permission   { id: ID!  resource: String!  action: String! }
type AuthPayload  { token: String  user: User! }
type Category     { id: ID!  categoryName: String! }
type Product      { id: ID!  productName: String!  unitPrice: Float!  category: Category! }
type Customer     { id: ID!  firstName: String!  lastName: String!  telephone: String!  email: String!  address: String! }
type Order        { id: ID!  customer: Customer!  product: Product!  quantity: Int!  total: Float! }

# Every list result has the same page envelope (UserPage, CategoryPage, ProductPage, CustomerPage, OrderPage)
type XxxPage      { content: [Xxx!]!  totalElements: Int!  totalPages: Int!  page: Int!  size: Int! }

input RegisterInput    { firstName: String!  lastName: String!  email: String!  password: String! }
input LoginInput       { email: String!  password: String! }
input CreateUserInput  { firstName: String!  lastName: String!  email: String!  password: String! }
input UpdateUserInput  { firstName: String!  lastName: String!  email: String! }
input RoleInput        { roleName: String! }
input PermissionInput  { resource: String!  action: String! }
input CategoryInput    { categoryName: String! }
input ProductInput     { productName: String!  unitPrice: Float!  categoryId: ID! }
input CustomerInput    { firstName: String!  lastName: String!  telephone: String!  email: String!  address: String! }
input OrderInput       { customerId: ID!  productId: ID!  quantity: Int! }
```

### Backend business rules the UI must respect

- `register` creates a **disabled** account; the user cannot log in until `activateAccount` succeeds with the activation token.
- Deleting a **category that still has products** is rejected with `BAD_REQUEST` (`BusinessRuleException`). The UI must surface the backend message, not a generic one.
- `createOrder` computes `total = quantity * product.unitPrice` **on the server**. The UI may display a preview but must always display the server's `total` once the order exists.
- `lockUser` / `unlockUser` toggle `accountLocked`. A locked or disabled user cannot log in.
- `logout` blacklists the current JWT server-side: the frontend must call it, then discard the token locally.

## Tech stack

| Component            | Choice                                                                                          |
|----------------------|-------------------------------------------------------------------------------------------------|
| Framework            | **Angular 21**, standalone components, no NgModules, zoneless change detection (the default for new Angular 21 apps) |
| Language             | TypeScript (the version bundled with Angular 21), `strict` mode                                 |
| Scaffolding          | Angular CLI 21 is the default way to create files: `ng generate` for code, `ng add` for libraries (see [Generate with the Angular CLI](#generate-with-the-angular-cli)) |
| State / reactivity   | Angular signals for local and view state; RxJS only where Apollo and subscriptions require it   |
| GraphQL client       | `apollo-angular` + `@apollo/client`                                                             |
| Subscriptions        | `graphql-ws` (`GraphQLWsLink` from `@apollo/client/link/subscriptions`)                         |
| Typed operations     | GraphQL Code Generator (`@graphql-codegen/cli`, `typescript`, `typescript-operations`, `typed-document-node`) |
| UI                   | Angular Material (create/update forms open in `MatDialog` dialogs)                              |
| Forms                | Typed Reactive Forms (Signal Forms are not used in this tutorial)                               |
| Routing              | Lazy-loaded standalone routes, functional guards and interceptors                               |
| Tests                | The unit-test runner that Angular 21 generates by default (Vitest, run with `ng test`), Angular `TestBed`, the Apollo testing utilities from `apollo-angular/testing` |
| Lint / format        | `angular-eslint`, Prettier                                                                      |
| Containerization     | Docker (multi-stage build, nginx), docker-compose                                               |
| CI/CD                | GitHub Actions                                                                                  |

Create the project with Angular CLI **21** (`npx @angular/cli@21 new ...`) and confirm with `ng version`. Choose versions of `apollo-angular`, `@apollo/client`, `@angular/material` and the other libraries that declare compatibility with Angular 21; if a peer-dependency conflict appears, stop and report it instead of forcing the install. Use a Node.js version supported by Angular 21. Do not add libraries that are not listed here without asking.

## Branching strategy

| Branch                      | Role                                                                                         |
|-----------------------------|----------------------------------------------------------------------------------------------|
| `master`                    | Stable code. No direct commits, only merges from `develop`.                                  |
| `develop`                   | Integration branch.                                                                          |
| `feature/core-architecture` | Project scaffold, Apollo setup, code generation, layout shell, error handling, Docker, CI.   |
| `feature/auth`              | Login, register, activation, password reset, session handling, guards; user/role/permission administration. |
| `feature/categories`        | Category list and CRUD.                                                                      |
| `feature/products`          | Product list and CRUD with category filter.                                                  |
| `feature/customers`         | Customer list and CRUD.                                                                      |
| `feature/orders`            | Order list, creation, and live updates through the `orderCreated` subscription.              |

The repository is currently empty: create `master`, then `develop` from it, then the first feature branch from `develop`.

## Project structure

```
angular-graphql-tutorial/
├── schema/
│   └── schema.graphqls                  (copy of the backend schema, input of code generation)
├── src/
│   ├── app/
│   │   ├── app.ts                       (root component; every component is a 4-file set generated by the CLI)
│   │   ├── app.config.ts                (provideRouter, provideHttpClient, provideApollo, ...)
│   │   ├── app.routes.ts
│   │   ├── core/
│   │   │   ├── graphql/
│   │   │   │   ├── apollo.config.ts     (HttpLink + error link + GraphQLWsLink + split)
│   │   │   │   ├── generated/           (codegen output: types and typed documents; never edited by hand)
│   │   │   │   └── error-mapper.ts      (GraphQL/network errors -> typed AppError)
│   │   │   ├── auth/
│   │   │   │   ├── auth.service.ts      (session signal, login/logout, token storage)
│   │   │   │   ├── auth.guard.ts
│   │   │   │   ├── admin.guard.ts
│   │   │   │   ├── auth.interceptor.ts  (adds the Bearer token to HTTP requests)
│   │   │   │   └── auth.models.ts
│   │   │   ├── notification/
│   │   │   │   └── notification.service.ts   (snackbar wrapper)
│   │   │   └── layout/
│   │   │       ├── shell/               (toolbar, sidenav, router outlet)
│   │   │       └── not-found/
│   │   ├── shared/
│   │   │   ├── ui/                      (confirm-dialog, page-header, empty-state, loading, error-banner)
│   │   │   └── pagination/              (paginator adapter for the backend page envelope)
│   │   └── features/
│   │       ├── auth/                    (login, register, activate, forgot-password, reset-password)
│   │       ├── users/                   (administration: list, form, role assignment)
│   │       ├── roles/                   (administration: roles, permissions, permission assignment)
│   │       ├── categories/
│   │       ├── products/
│   │       ├── customers/
│   │       └── orders/
│   ├── environments/                    (environment.ts, environment.development.ts: generated with `ng generate environments`)
│   └── styles.scss
├── proxy.conf.json                      (dev proxy to the backend, HTTP and WebSocket)
├── codegen.ts
├── Dockerfile
├── nginx.conf
├── docker-compose.yml
├── .github/workflows/ci.yml
├── angular.json
├── package.json
└── README.md
```

Each `features/<name>/` folder contains: `<name>.routes.ts`, a `data/` folder with `<name>.graphql` documents and a `<name>.service.ts` service wrapping Apollo, a `models/` folder (interfaces and enums of the feature: form values, filters, view models; the GraphQL operation types come from code generation), and `pages/` (routed list and detail pages), `components/` (presentational components) and `dialogs/` (the create/update form dialogs). Every file that has an Angular CLI schematic (component, page, dialog, service, model, guard, interceptor, pipe, ...) is generated with `ng generate` (see [Generate with the Angular CLI](#generate-with-the-angular-cli)).

## GraphQL conventions on the frontend

- **Operations are written in `.graphql` files** next to the feature that uses them, and **typed through code generation**. Components and services never use untyped `gql` strings, and never use `any` for a result.
- **Schema source**: `schema/schema.graphqls` is a copy of the backend file. Code generation reads that local copy so that `npm run codegen` works without the backend running. When the backend schema changes, refresh the copy and regenerate (see `npm run schema:update` in core-architecture).
- **Fragments** for each entity (`CategoryFields`, `ProductFields`, `CustomerFields`, `OrderFields`, `UserFields`, `RoleFields`) so list and detail views, and mutation results, share one shape and the Apollo cache normalizes consistently.
- **Request exactly what the screen shows.** Nested fields (`Product.category`, `Order.customer`, `Order.product`, `User.roles`, `Role.permissions`) are requested **in the same query** as their parent, never through extra round trips: the backend resolves them with `DataLoader` batching precisely so that one query is cheap. Do not request nested fields a screen does not display.
- **Cache**: use Apollo's normalized `InMemoryCache`. After a mutation, update the cache (`update` callback, `cache.evict`/`refetchQueries`) so the list the user returns to is correct. Prefer cache updates over blanket refetching when the mutation returns the changed entity.
- **Pagination**: all lists use `page` and `size` and return the same page envelope (`content`, `totalElements`, `totalPages`, `page`, `size`). Wrap this in one shared adapter used by every Material paginator. The adapter converts between Material's 0-based paginator and the backend's `page` numbering.
- **IDs are strings** (`ID!`), even though the backend uses numeric database ids. Never parse them to numbers.
- **`Float` fields** (`unitPrice`, `total`) are displayed with the `currency` pipe or a shared formatter; never do arithmetic on money for anything other than a labelled preview.
- **Services wrap Apollo.** Components never inject `Apollo` directly; they call a feature `*.service.ts` service that returns typed observables or signals.

## Authentication and authorization

### Session

- `login` returns `AuthPayload { token, user }`. Store the token (and nothing sensitive besides it) in `localStorage` under a single key, expose the session through a signal in `AuthService` (`token`, `currentUser`, `isAuthenticated`, `isAdmin`).
- On application start, if a token exists, call the `me` query to validate it and load the current user with their `roles`. If it fails, clear the session and route to `/login`.
- The token lasts **1 hour**. There is no refresh-token mutation: when the backend rejects the token, clear the session, keep the target URL, redirect to `/login`, and return to the target URL after a successful login.
- `logout` calls the `logout` mutation (best effort: clear the local session even if the call fails), clears the Apollo cache (`client.clearStore()`), and navigates to `/login`.

### Sending the token

- HTTP: a functional interceptor, `authInterceptor` (generated with `ng generate interceptor`), registered with `provideHttpClient(withInterceptors([authInterceptor]))`, adds `Authorization: Bearer <token>` when a token exists. Apollo Angular's `HttpLink` sends every query and mutation through `HttpClient`, so the interceptor covers them all.
- WebSocket: pass the token through the `graphql-ws` `connectionParams` as well. The WebSocket client must be recreated (or `dispose()`d and reconnected) when the user logs in or out, so a subscription never runs with a stale identity.

### Authorization in the UI

- `authGuard`: requires a valid session, otherwise redirects to `/login`.
- `adminGuard`: requires the current user to hold the admin role. Derive `isAdmin` from `me { roles { roleName } }`; normalize the comparison so both `ADMIN` and `ROLE_ADMIN` are accepted.
- Hide or disable admin-only actions for non-admin users, **but treat this as UX only**: the backend enforces authorization (`@PreAuthorize`) and its `FORBIDDEN` errors must still be handled gracefully.
- Admin-only areas (per backend spec): user, role and permission administration; create, update and delete of categories and products.

## Error handling

GraphQL always answers `200 OK`, so the usual `HttpErrorResponse` status checks are **not** enough.

- Centralize error handling in an Apollo **error link** plus `error-mapper.ts`, which converts any failure into one `AppError { kind, message, fieldErrors? }` where `kind` is one of: `NOT_FOUND`, `BAD_REQUEST`, `FORBIDDEN`, `UNAUTHENTICATED`, `INTERNAL_ERROR`, `NETWORK`.
- Map `errors[].extensions.classification` to `kind`. A transport-level `401`/`403` (e.g. rejected token before GraphQL execution) maps to `UNAUTHENTICATED`/`FORBIDDEN`; network failures map to `NETWORK`.
- Behavior per kind:
  - `UNAUTHENTICATED`: clear the session, redirect to `/login`, keep the return URL.
  - `FORBIDDEN`: show a notification; if it happens on navigation, route to a "not allowed" page.
  - `BAD_REQUEST`: show the backend message (it is a business or validation message) inline in the dialog form (the dialog stays open) or in a snackbar. Never replace it with a generic text.
  - `NOT_FOUND`: show a not-found state for detail pages.
  - `INTERNAL_ERROR` / `NETWORK`: generic message with a retry action.
- **Partial responses are normal**: a response can contain both `data` and `errors`. Use Apollo `errorPolicy: 'all'` where a screen can usefully render partial data, and handle `errors` explicitly. Do not treat the presence of `data` as success.
- Every list/detail screen has three explicit states: loading, error (with retry), and empty.

## Testing strategy

Every branch ships its tests before its pull request is opened.

| Layer             | Tool                                                  | What it verifies                                                                                       |
|-------------------|-------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| Services          | `TestBed` + Apollo testing utilities                  | Each `*.service.ts` sends the right operation and variables, maps results, and propagates mapped errors.   |
| Error mapping     | Unit tests                                            | Every `classification` and transport failure maps to the right `AppError.kind`.                        |
| Guards / session  | `TestBed`                                             | `authGuard`, `adminGuard`, token storage, session restore through `me`, logout clears state.           |
| Components        | `TestBed` + component harnesses (Material)            | Loading / error / empty / data states, form validation, user actions calling the right service method. |
| Subscription      | Unit tests with a mocked `orderCreated` stream        | New events update the orders list without a reload.                                                    |

Tests must not require the real backend to be running. Test files and test names follow the Angular CLI's existing conventions (`*.spec.ts` next to the code, `describe` / `it` blocks).

## feature/core-architecture

### Tasks

- [x] Create the project with Angular CLI **21** in the current repository root (standalone, SCSS, routing, no SSR, existing git repository kept): `npx @angular/cli@21 new angular-graphql-tutorial --directory . --style=scss --ssr=false --skip-git`. `ng new` generates its own `README.md` and would replace this one: keep a copy of this file and restore it right after the generation. Confirm with `ng version` that the project is on Angular 21, and keep strict TypeScript and strict templates enabled.
- [x] Install: `apollo-angular`, `@apollo/client`, `graphql`, `graphql-ws`, `@angular/material`, `@angular/cdk`; dev: `@graphql-codegen/cli`, `@graphql-codegen/typescript`, `@graphql-codegen/typescript-operations`, `@graphql-codegen/typed-document-node`, `@graphql-codegen/near-operation-file-preset` (only if used), `angular-eslint`, `prettier`
- [x] Environments: run `ng generate environments` (creates `environment.ts` and `environment.development.ts` and registers the file replacement in `angular.json`), then add `apiUrl` (`/graphql` through the proxy in dev) and `wsUrl`
- [x] `proxy.conf.json`: proxy `/graphql` to `http://localhost:8080`, with `"ws": true` so the WebSocket upgrade is forwarded; wire it in `angular.json` for `ng serve`. This also avoids any CORS dependency on the backend in development.
- [x] `apollo.config.ts`: `provideApollo` with an `HttpLink`, an error link (delegates to `error-mapper`), a `GraphQLWsLink`, and `split()` so subscriptions go over WebSocket and everything else over HTTP; `InMemoryCache`
- [x] `authInterceptor` (`ng generate interceptor core/auth/auth`) reading the token from `AuthService`, registered in `app.config.ts`, with unit tests
- [x] `codegen.ts` reading `schema/schema.graphqls` and every `src/**/*.graphql`, generating types and typed document nodes into `src/app/core/graphql/generated/`. npm scripts: `codegen`, `codegen:watch`, `schema:update` (downloads the backend schema into `schema/schema.graphqls` from the backend repository's `src/main/resources/graphql/schema.graphqls`)
- [x] Commit `schema/schema.graphqls`. Decide explicitly whether generated files are committed (recommended: **committed**, so CI and fresh clones build without an extra step) and document the choice
- [x] `error-mapper.ts` and the error link, with unit tests
- [x] App shell: Material toolbar + sidenav + `router-outlet`, navigation entries for each domain (entries for not-yet-implemented features are added by their own branch), not-found page, global loading/error primitives in `shared/ui`
- [x] `NotificationService` (snackbar) used by all features for success and error messages
- [x] Shared page-envelope adapter for Material paginators
- [x] ESLint + Prettier configuration; `npm run lint` must pass
- [x] `Dockerfile` (multi-stage: Node build, then nginx serving `dist` and proxying `/graphql` to the backend, WebSocket upgrade headers included), `nginx.conf`, and a `docker-compose.yml` that runs the frontend and expects the backend reachable (either as a service built from the backend repository or via `host.docker.internal`; document the chosen option)
- [x] `.github/workflows/ci.yml`: install, lint, test, build on every push and pull request
- [x] Replace this README's "How to follow" commands if the real commands differ

## feature/auth

Depends on `feature/core-architecture`. Authentication first, then administration.

### Authentication screens (public routes)

| Route               | Operation(s)                                   | Behavior                                                                                            |
|---------------------|------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| `/login`            | `login`                                        | Email + password; on success store session, go to the return URL or `/`.                            |
| `/register`         | `register`                                     | First name, last name, email, password; on success explain that the account must be activated.      |
| `/activate?token=`  | `activateAccount`                              | Reads the token from the query string, calls the mutation, shows success or the backend error.      |
| `/forgot-password`  | `requestPasswordReset`                         | Email only. Always show the same neutral confirmation message, whatever the backend answers about the email. |
| `/reset-password?token=` | `resetPassword`                           | New password + confirmation (client-side match check); token from the query string.                 |

### Administration screens (ADMIN only, behind `authGuard` + `adminGuard`)

| Area        | Operations                                                                                          | Screens                                                                                                                              |
|-------------|-----------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Users       | `users`, `user`, `createUser`, `updateUser`, `lockUser`, `unlockUser`, `deleteUser`                 | Paginated table (name, email, enabled, locked, roles as chips), create/edit dialog, lock/unlock and delete with confirmation.          |
| User roles  | `roles`, `assignRoleToUser`, `removeRoleFromUser`                                                   | In a "Manage roles" dialog opened from the user row: assigned roles as removable chips and an "add role" select listing the roles not yet assigned.        |
| Roles       | `roles`, `role`, `createRole`, `updateRole`, `deleteRole`                                           | Table of roles with their permissions, create/edit dialog, delete with confirmation.                                                   |
| Role permissions | `permissions`, `assignPermissionToRole`, `removePermissionFromRole`                            | In a "Manage permissions" dialog opened from the role row: assigned permissions as removable chips and an "add permission" select.                                            |
| Permissions | `permissions`, `createPermission`, `deletePermission`                                               | Simple table (`resource`, `action`), create dialog, delete with confirmation.                                                          |

### Tasks

- [x] `AuthService` (session signal, token storage, `login`, `logout`, session restore with `me`, `isAdmin`), `authGuard`, `adminGuard`, with tests
- [x] The `authInterceptor` already reads the token for HTTP: make the WebSocket link reconnect on login/logout
- [x] The five public screens above, with typed reactive forms and field-level validation matching the backend inputs (all fields required; valid email format; sensible password minimum length shown as UX guidance only, since the backend is the authority)
- [x] On a `BAD_REQUEST` returned by `register`, `login` or a form mutation, display the backend message
- [x] Return-URL handling after a forced redirect to `/login`
- [x] Admin screens above, using the `UserFields`, `RoleFields` fragments; `User.roles` and `Role.permissions` requested in the list queries (one round trip each)
- [x] After assignment mutations, update the cache from the returned `User`/`Role` so chips update immediately
- [x] A user must not be able to delete or lock **their own** account from the UI (disable those actions on the current user's row)
- [x] Navigation: show the Administration menu only to admins
- [x] Tests: error mapping into the login form, session restore, guards, role assignment cache update, a non-admin being redirected from an admin route

## feature/categories

Depends on `feature/core-architecture`.

| Operation                                          | Screen / action                                  |
|----------------------------------------------------|--------------------------------------------------|
| `categories(page, size)`                           | Paginated table                                  |
| `category(id)`                                     | Not needed for edit: the dialog is pre-filled from the list row                                |
| `createCategory(input)` / `updateCategory(id, input)` | Create/edit dialog (`categoryName`), ADMIN only |
| `deleteCategory(id)`                               | Delete with confirmation, ADMIN only             |

### Tasks

- [x] `CategoryFields` fragment, `.graphql` documents, `categories.service.ts`, routes, list page, create/edit dialog
- [x] Deleting a category that still has products returns `BAD_REQUEST`: show the backend message and keep the row
- [x] Cache update after create/update/delete so the list is correct on return
- [x] `Category` options are reused by the products feature (category select and filter): expose a small `CategoryOptionsService` or a query reused there rather than duplicating it
- [x] Tests: list states, form validation, delete rejection path

## feature/products

Depends on `feature/categories`.

| Operation                                             | Screen / action                                           |
|-------------------------------------------------------|-----------------------------------------------------------|
| `products(categoryId, page, size)`                    | Paginated table with a category filter                    |
| `product(id)`                                         | Not needed for edit: the dialog is pre-filled from the list row                                         |
| `createProduct(input)` / `updateProduct(id, input)`   | Create/edit dialog: `productName`, `unitPrice`, `categoryId` (select), ADMIN only |
| `deleteProduct(id)`                                   | Delete with confirmation, ADMIN only                      |

### Tasks

- [x] `ProductFields` fragment including `category { ...CategoryFields }`: the list must be **one** request, never one request per product row
- [x] Category filter: changing it resets to the first page and re-queries with `categoryId`
- [x] `unitPrice` input: numeric, greater than 0 (UX validation), displayed with the currency formatter
- [x] Tests: filter behavior, one-request list, form validation

## feature/customers

Depends on `feature/core-architecture`.

| Operation                                               | Screen / action                         |
|---------------------------------------------------------|-----------------------------------------|
| `customers(page, size)`                                 | Paginated table                         |
| `customer(id)`                                          | Not needed for edit: the dialog is pre-filled from the list row              |
| `createCustomer(input)` / `updateCustomer(id, input)`   | Create/edit dialog: first name, last name, telephone, email, address |
| `deleteCustomer(id)`                                    | Delete with confirmation                |

### Tasks

- [x] `CustomerFields` fragment, documents, `customers.service.ts`, routes, pages
- [x] Email format validation and required fields in the dialog form
- [x] Handle the backend rejecting a deletion (e.g. customer with orders) by showing its message
- [x] Tests

## feature/orders

Depends on `feature/products` and `feature/customers`.

| Operation                                          | Screen / action                                                          |
|----------------------------------------------------|--------------------------------------------------------------------------|
| `orders(customerId, page, size)`                   | Paginated table with a customer filter                                   |
| `order(id)`                                        | Detail page                                                              |
| `createOrder(input)`                               | Create dialog: customer (select), product (select), quantity (integer >= 1)       |
| `orderCreated` (subscription)                      | Live update of the orders list                                           |

### Tasks

- `OrderFields` fragment including `customer { ...CustomerFields }` and `product { ...ProductFields }` (which includes its category): lists are one request
- The order dialog shows a **preview** of the total (`quantity * unitPrice`) clearly labelled as an estimate; after creation, display the server's `total`
- Subscribe to `orderCreated` while the orders page is open; on each event, add the new order to the cached list (or refetch the first page) so it appears without reload; show a snackbar "New order #<id>"; unsubscribe on destroy
- The order created by the current user also arrives through the subscription: **do not insert it twice** (deduplicate by `id`)
- Handle the WebSocket lifecycle: reconnect with backoff after a drop, and surface a discreet "live updates unavailable" indicator when disconnected
- Tests: dedupe on create + subscription event, list updated on event, unsubscribe on destroy, preview vs server total

## Order of work

1. `feature/core-architecture` -> Pull Request to `develop`
2. `feature/auth` (depends on `core-architecture`) -> Pull Request to `develop`
3. `feature/categories` (depends on `core-architecture`) -> Pull Request to `develop`
4. `feature/products` (depends on `categories`) -> Pull Request to `develop`
5. `feature/customers` (depends on `core-architecture`) -> Pull Request to `develop`
6. `feature/orders` (depends on `products`, `customers`) -> Pull Request to `develop`
7. `develop` -> `master`

## Generate with the Angular CLI

Everything that has an Angular CLI schematic is created with `ng generate` (or `ng add` for libraries), never by creating the file by hand. This keeps file layout, naming, class suffixes, spec files and workspace registration consistent, and it means every generated unit starts with its `.spec.ts` file, which is kept and filled with real tests (see [Testing strategy](#testing-strategy)).

| To create                                   | Command (examples)                                                                  |
|---------------------------------------------|-------------------------------------------------------------------------------------|
| Page (routed component)                     | `ng generate component features/categories/pages/category-list --type=page` (gives `category-list.page.ts`, `.html`, `.scss`, `.spec.ts`) |
| Dialog (create/update form)                 | `ng generate component features/categories/dialogs/category-form --type=dialog` (gives `category-form.dialog.ts`, `.html`, `.scss`, `.spec.ts`) |
| Presentational component                    | `ng generate component features/categories/components/category-table` (four files: `.ts`, `.html`, `.scss`, `.spec.ts`) |
| Service (API, session, notification, ...)   | `ng generate service features/categories/data/categories` (default type, no `--type`); `ng generate service core/notification/notification` |
| Model (interface), enum, class              | `ng generate interface features/products/models/product-filter --type=model` (gives `product-filter.model.ts`); `ng generate enum ...`; `ng generate class ...` |
| Guard                                       | `ng generate guard core/auth/auth --functional`                                     |
| HTTP interceptor                            | `ng generate interceptor core/auth/auth --functional`                               |
| Pipe, directive                             | `ng generate pipe shared/pipes/currency-format`; `ng generate directive shared/directives/...` |
| Resolver (if one is needed)                 | `ng generate resolver ... --functional`                                             |
| Environments                                | `ng generate environments`                                                          |
| Angular Material, ESLint                    | `ng add @angular/material`; `ng add angular-eslint`                                 |

Rules:

- Run the schematic from the repository root with the full path (`features/<name>/<folder>/<item>`), so the file lands in the right place and its spec file is generated next to it.
- **Keep the CLI's default type wherever one exists.** Schematics that already have a default type (service, guard, interceptor, pipe, directive, resolver) are run **without** `--type`. Pass `--type` only where the table shows it (`page`, `dialog`, `model`): those schematics have no default type, and it makes the role of the file explicit in its name. Never create these files by hand or rename them afterwards.
- **Keep the file and class names the CLI produces.** This README writes service names in the classic form (`categories.service.ts`, `CategoriesService`, `AuthService`, `NotificationService`); if the installed CLI 21 names a generated file differently, follow the CLI and adapt the references.
- Use the schematic options that match this tutorial: functional guards and interceptors, standalone components, SCSS.
- Files **without** a schematic are written by hand: `.graphql` documents, `*.routes.ts`, `error-mapper.ts` and other plain functions, `codegen.ts`, `proxy.conf.json`, Docker and CI files.

## Code conventions

- Angular 21 idioms: standalone components only, zoneless-compatible code (state in signals, no reliance on Zone.js), `ChangeDetectionStrategy.OnPush` everywhere; use `inject()` rather than constructor injection; use the built-in control flow (`@if`, `@for`, `@switch`), signal-based `input()`/`output()`/`model()` and `computed()`/`effect()` for view state.
- **Smart / dumb split**: page components fetch data and orchestrate; presentational components receive inputs and emit outputs.
- Components never contain GraphQL logic: they call a feature `*.service.ts` service. `*.service.ts` services never contain UI logic (no snackbars, no navigation).
- Every operation is a typed `.graphql` document processed by code generation. Hand-edited files under `generated/` are forbidden.
- No `any`. No non-null assertions (`!`) to silence the compiler. Treat `strict` errors as real errors.
- Reactive forms are typed (`FormGroup<...>`); validation messages are explicit and in one place per form.
- **Generate, never hand-create**: every file type that has an Angular CLI schematic is created with `ng generate` (see [Generate with the Angular CLI](#generate-with-the-angular-cli)). Components get the standard four files (`.ts`, `.html`, `.scss`, `.spec.ts`), with templates and styles in their own files (`templateUrl`, `styleUrl`), never inline. Pages and dialogs are components too.
- **Create and update go through dialogs.** Every create/update form (user, role, permission, category, product, customer, order) is a dialog component opened with Angular Material's `MatDialog` from the list page, never a separate routed form page. A dialog receives the entity to edit (or nothing, for a create) through `MAT_DIALOG_DATA`, pre-fills its typed form from it, and disables the submit button while the mutation is running. On success it closes with the saved entity and the list updates through the Apollo cache; on a `BAD_REQUEST` it stays open and shows the backend message inline. Delete confirmations use the shared `confirm-dialog`. Routed pages are reserved for lists, details and the public authentication screens (login, register, activate, forgot/reset password).
- Subscriptions and long-lived observables are always cleaned up (`takeUntilDestroyed`, `async` pipe, or signal conversion).
- Feature folders are lazy loaded; each exposes a `*.routes.ts`.
- File names: kebab-case, named by the CLI: the default type for services, guards and interceptors (`categories.service.ts`, `auth.guard.ts`, `auth.interceptor.ts`) and `--type` for pages, dialogs and models (`category-list.page.ts`, `category-form.dialog.ts`, `product.model.ts`).
- Never log tokens or passwords. Never put the token in a URL.
- Commit messages are imperative and scoped (`auth: restore session through me query`).

## Concepts covered

- Consuming a schema-first GraphQL API from Angular with Apollo Angular
- Typed GraphQL operations with GraphQL Code Generator (schema as the single source of truth)
- Fragments and Apollo's normalized cache, including cache updates after mutations
- Single-round-trip queries over nested fields (the frontend counterpart of the backend's `DataLoader` batching)
- Authentication with JWT: session signal, HTTP auth interceptor, guards, forced re-login and return URL
- Role-based UI on top of server-enforced authorization
- Structured GraphQL error handling (`extensions.classification`), partial responses, `errorPolicy`
- Real-time updates with GraphQL subscriptions over WebSocket (`graphql-ws`), reconnection and deduplication
- Modern Angular 21: standalone components, zoneless change detection, signals, functional guards/interceptors, lazy routes, typed reactive forms
- Dev proxy for HTTP and WebSocket, Docker multi-stage build with nginx, GitHub Actions CI

## How to follow this tutorial

1. Start the backend (see its README):
   ```bash
   git clone https://github.com/EdgarEldy/spring-graphql-tutorial.git
   cd spring-graphql-tutorial
   git checkout develop        # or master, whichever holds the finished backend
   docker-compose up
   ```
   Open GraphiQL at `http://localhost:8080/graphiql` to explore the schema and try every operation before coding it.
2. Clone this repository and check out `develop`:
   ```bash
   git clone https://github.com/EdgarEldy/angular-graphql-tutorial.git
   cd angular-graphql-tutorial
   git checkout develop
   npm install
   ```
3. Follow the branches in order: `feature/core-architecture` -> `feature/auth` -> `feature/categories` -> `feature/products` -> `feature/customers` -> `feature/orders`.
4. Run the app against the backend:
   ```bash
   npm run codegen
   npm start                   # ng serve with proxy.conf.json, http://localhost:4200
   ```
5. Quality gates before every pull request: `npm run lint`, `npm test`, `npm run build`.
