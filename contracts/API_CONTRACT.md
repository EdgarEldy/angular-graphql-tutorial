# API Contract

Backend: `spring-graphql-tutorial` (Spring Boot 4.1, Spring for GraphQL)
Endpoint: `POST http://localhost:8080/graphql`
Subscriptions: WebSocket `ws://localhost:8080/graphql` (protocol: `graphql-ws`)
GraphiQL: `GET http://localhost:8080/graphiql` (dev profile only)

---

## Transport

- All operations use HTTP POST to `/graphql` (queries and mutations).
- Subscriptions use WebSocket on the same path with the `graphql-ws` sub-protocol.
- The server **always** returns HTTP 200. Errors are in `response.errors`, not in the status code.
- Error shape: `errors[].extensions.classification` carries one of:
  `NOT_FOUND`, `BAD_REQUEST`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

## Authentication

- Login returns a JWT (`AuthPayload.token`). Lifetime: 1 hour. No refresh token.
- HTTP: send as `Authorization: Bearer <token>` header.
- WebSocket: send as `connectionParams.Authorization: "Bearer <token>"`.
- `register` creates a **disabled** account; the user cannot log in until `activateAccount` succeeds.
- `logout` blacklists the JWT server-side. The frontend must call it before discarding the token locally.
- On token rejection: clear session, redirect to `/login` with return URL.

---

## Queries

### `me: User` (nullable)

| | |
|---|---|
| Access | Authenticated |
| Arguments | none |
| Returns | `User` (null if no valid session) |
| Screen | App startup (session restore), profile |
| Errors | `UNAUTHENTICATED` if token invalid |

Fields requested: `id firstName lastName email enabled accountLocked roles { id roleName permissions { id resource action } }`

---

### `users(page: Int, size: Int): UserPage!`

| | |
|---|---|
| Access | ADMIN |
| Arguments | `page` (0-based), `size` |
| Returns | `UserPage!` |
| Screen | Admin > Users list |
| Errors | `FORBIDDEN` if not ADMIN |

---

### `user(id: ID!): User`

| | |
|---|---|
| Access | ADMIN |
| Arguments | `id: ID!` |
| Returns | `User` (nullable) |
| Errors | `FORBIDDEN`, `NOT_FOUND` |

---

### `roles: [Role!]!`

| | |
|---|---|
| Access | ADMIN |
| Screen | Admin > Roles list, role assignment select |
| Errors | `FORBIDDEN` |

---

### `role(id: ID!): Role`

| | |
|---|---|
| Access | ADMIN |
| Errors | `FORBIDDEN`, `NOT_FOUND` |

---

### `permissions: [Permission!]!`

| | |
|---|---|
| Access | ADMIN |
| Screen | Admin > Permissions list, permission assignment |
| Errors | `FORBIDDEN` |

---

### `categories(page: Int, size: Int): CategoryPage!`

| | |
|---|---|
| Access | Enforced by backend |
| Screen | Categories list |

---

### `category(id: ID!): Category`

| | |
|---|---|
| Access | Enforced by backend |
| Screen | Not used directly (dialog pre-filled from list) |
| Errors | `NOT_FOUND` |

---

### `products(categoryId: ID, page: Int, size: Int): ProductPage!`

| | |
|---|---|
| Access | Enforced by backend |
| Arguments | `categoryId` optional filter |
| Screen | Products list (with category filter) |

---

### `product(id: ID!): Product`

| | |
|---|---|
| Access | Enforced by backend |
| Screen | Not used directly (dialog pre-filled from list) |
| Errors | `NOT_FOUND` |

---

### `customers(page: Int, size: Int): CustomerPage!`

| | |
|---|---|
| Access | Enforced by backend |
| Screen | Customers list |

---

### `customer(id: ID!): Customer`

| | |
|---|---|
| Access | Enforced by backend |
| Screen | Not used directly (dialog pre-filled from list) |
| Errors | `NOT_FOUND` |

---

### `orders(customerId: ID, page: Int, size: Int): OrderPage!`

| | |
|---|---|
| Access | Enforced by backend |
| Arguments | `customerId` optional filter |
| Screen | Orders list (with customer filter) |

---

### `order(id: ID!): Order`

| | |
|---|---|
| Access | Enforced by backend |
| Screen | Order detail page |
| Errors | `NOT_FOUND` |

---

## Mutations

### Auth mutations

#### `register(input: RegisterInput!): AuthPayload!`

| | |
|---|---|
| Access | Public |
| Input | `firstName String!`, `lastName String!`, `email String!`, `password String!` |
| Returns | `AuthPayload { token user }` |
| Screen | `/register` |
| Errors | `BAD_REQUEST` (validation, email already taken) |
| Business rule | Account is disabled until `activateAccount` is called |

#### `activateAccount(token: String!): Boolean!`

| | |
|---|---|
| Access | Public |
| Input | `token String!` (from query string) |
| Screen | `/activate?token=` |
| Errors | `BAD_REQUEST` (invalid/expired token) |

#### `login(input: LoginInput!): AuthPayload!`

| | |
|---|---|
| Access | Public |
| Input | `email String!`, `password String!` |
| Returns | `AuthPayload { token user }` |
| Screen | `/login` |
| Errors | `BAD_REQUEST` (invalid credentials, locked/disabled account) |

#### `logout: Boolean!`

| | |
|---|---|
| Access | Authenticated |
| Screen | Any (triggered on logout action) |
| Note | Blacklists the JWT server-side. Call before clearing local session. |

#### `requestPasswordReset(email: String!): Boolean!`

| | |
|---|---|
| Access | Public |
| Screen | `/forgot-password` |
| Note | Always show a neutral confirmation regardless of whether the email exists |

#### `resetPassword(token: String!, newPassword: String!): Boolean!`

| | |
|---|---|
| Access | Public |
| Screen | `/reset-password?token=` |
| Errors | `BAD_REQUEST` (invalid/expired token) |

---

### User mutations (ADMIN only)

#### `createUser(input: CreateUserInput!): User!`

Input: `firstName String!`, `lastName String!`, `email String!`, `password String!`
Errors: `FORBIDDEN`, `BAD_REQUEST`

#### `updateUser(id: ID!, input: UpdateUserInput!): User!`

Input: `firstName String!`, `lastName String!`, `email String!`
Errors: `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`

#### `lockUser(id: ID!): User!` / `unlockUser(id: ID!): User!`

Toggles `accountLocked`. The UI must not allow locking/unlocking the current user's own account.
Errors: `FORBIDDEN`, `NOT_FOUND`

#### `deleteUser(id: ID!): Boolean!`

The UI must not allow deleting the current user's own account.
Errors: `FORBIDDEN`, `NOT_FOUND`

#### `assignRoleToUser(userId: ID!, roleId: ID!): User!`

Returns the updated `User` with all roles. Update the cache from the returned user.
Errors: `FORBIDDEN`, `NOT_FOUND`

#### `removeRoleFromUser(userId: ID!, roleId: ID!): User!`

Returns the updated `User` with remaining roles.
Errors: `FORBIDDEN`, `NOT_FOUND`

---

### Role mutations (ADMIN only)

#### `createRole(input: RoleInput!): Role!`

Input: `roleName String!`

#### `updateRole(id: ID!, input: RoleInput!): Role!`

#### `deleteRole(id: ID!): Boolean!`

#### `createPermission(input: PermissionInput!): Permission!`

Input: `resource String!`, `action String!`

#### `deletePermission(id: ID!): Boolean!`

#### `assignPermissionToRole(roleId: ID!, permissionId: ID!): Role!`

Returns the updated `Role` with all permissions.

#### `removePermissionFromRole(roleId: ID!, permissionId: ID!): Role!`

Returns the updated `Role` with remaining permissions.

---

### Category mutations (ADMIN only)

#### `createCategory(input: CategoryInput!): Category!`

Input: `categoryName String!`
Errors: `FORBIDDEN`, `BAD_REQUEST`

#### `updateCategory(id: ID!, input: CategoryInput!): Category!`

Errors: `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`

#### `deleteCategory(id: ID!): Boolean!`

Errors: `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST` (if the category still has products -- show the backend message, do not replace with a generic one)

---

### Product mutations (ADMIN only)

#### `createProduct(input: ProductInput!): Product!`

Input: `productName String!`, `unitPrice Float!`, `categoryId ID!`
Errors: `FORBIDDEN`, `BAD_REQUEST`

#### `updateProduct(id: ID!, input: ProductInput!): Product!`

Errors: `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`

#### `deleteProduct(id: ID!): Boolean!`

Errors: `FORBIDDEN`, `NOT_FOUND`

---

### Customer mutations

#### `createCustomer(input: CustomerInput!): Customer!`

Input: `firstName String!`, `lastName String!`, `telephone String!`, `email String!`, `address String!`

#### `updateCustomer(id: ID!, input: CustomerInput!): Customer!`

#### `deleteCustomer(id: ID!): Boolean!`

Errors: `BAD_REQUEST` (e.g. customer has orders -- show backend message)

---

### Order mutations

#### `createOrder(input: OrderInput!): Order!`

Input: `customerId ID!`, `productId ID!`, `quantity Int!`
Note: `total` is computed server-side as `quantity * product.unitPrice`. The UI may show a
client-side preview labeled as an estimate, but must display the server's `total` after creation.

---

## Subscription

### `orderCreated: Order!`

| | |
|---|---|
| Access | Authenticated (token in `connectionParams`) |
| Screen | Orders list (while open) |
| Behavior | Add new order to cached list; show snackbar "New order #<id>"; deduplicate by `id` |

---

## Types

### Page envelope (all list types follow this shape)

```graphql
type XxxPage {
  content: [Xxx!]!
  totalElements: Int!
  totalPages: Int!
  page: Int!      # 0-based
  size: Int!
}
```

Note: the backend uses 0-based page numbering. Angular Material paginator is also 0-based,
so no offset conversion is needed at the API level.

### Fragments (reused across features)

```graphql
fragment UserFields on User {
  id firstName lastName email enabled accountLocked
  roles { id roleName }
}

fragment RoleFields on Role {
  id roleName
  permissions { id resource action }
}

fragment PermissionFields on Permission {
  id resource action
}

fragment CategoryFields on Category {
  id categoryName
}

fragment ProductFields on Product {
  id productName unitPrice
  category { ...CategoryFields }
}

fragment CustomerFields on Customer {
  id firstName lastName telephone email address
}

fragment OrderFields on Order {
  id quantity total
  customer { ...CustomerFields }
  product { ...ProductFields }
}
```

---

## Business rules the UI must enforce

1. After `register`: show an activation-required message; do not auto-login.
2. Deleting a category that has products: the backend returns `BAD_REQUEST` with a business message. Surface it verbatim; keep the row.
3. `createOrder.total` comes from the server. Client-side preview is labelled "estimate".
4. `lockUser` / `unlockUser` and `deleteUser` must be disabled for the current user's own row.
5. `logout` must call the mutation before discarding the token (best-effort; clear locally even if the call fails).
6. IDs are strings, never cast to numbers.
7. `unitPrice` and `total` (Float) are displayed with the currency pipe; do not do arithmetic on them except for the order preview.
