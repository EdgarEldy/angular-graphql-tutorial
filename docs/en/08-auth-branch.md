# Branch: feature/auth

This branch builds on `feature/core-architecture` and adds the full authentication and RBAC
layer: public auth screens, JWT session management, route guards, template directives, the
user/role/permission administration screens, and the profile page.

---

## What you will learn

- How to implement a login/register flow with JWT tokens
- How to store a session across page reloads with `localStorage` and Angular signals
- How to protect routes with guards (`authGuard`, `adminGuard`)
- How to show and hide UI elements based on roles with a structural directive
- How to build a full CRUD screen with role and permission assignment
- How to update the Apollo cache after assigning roles or permissions

---

## Public authentication screens

These routes are accessible without being logged in.

| Route | Mutation | What happens |
|---|---|---|
| `/auth/login` | `login` | Submits email + password; on success stores tokens and navigates to the return URL or `/dashboard` |
| `/auth/register` | `register` | Submits firstName, lastName, email, password, confirmPassword; on success shows a "check your email" message |
| `/auth/activate-account?token=` | `activateAccount` | Reads the token from the query string; activates the account; shows success or error |
| `/auth/forgot-password` | `requestPasswordReset` | Submits email; always shows the same neutral confirmation (backend hides whether the email exists) |
| `/auth/reset-password?token=` | `resetPassword` | Submits new password + confirm; token from query string |

**Activation flow in detail:**

1. After registering, the backend sends an email with a link like
   `http://localhost:4200/auth/activate-account?token=abc123`.
2. MailHog captures the email at `http://localhost:8025`.
3. Click the link (or paste the URL into the browser). The `ActivateAccountPage` reads the
   `token` query param and calls the `activateAccount` mutation automatically on load.
4. On success, it shows a "Your account is active, please log in" message and a link to the
   login page.

**Inline error on login:**  
A 401 from `POST /graphql` for a `login` mutation means wrong credentials. The error is
shown inline on the email/password field, not as a redirect to the login page (which is the
standard 401 behaviour everywhere else).

---

## Session management after login

When `login` succeeds, `AuthService.login()`:

1. Stores the `accessToken` and `refreshToken` in `localStorage`.
2. Decodes the JWT payload (`auth.ts`) to extract the user's id, email, roles, and permissions.
3. Updates the `_session` signal with the decoded payload.
4. The computed signals (`isAuthenticated`, `isAdmin`, `roles`, `permissions`) update
   automatically because they read `_session`.
5. The shell's Administration section appears immediately because it reads `isAdmin()`.

---

## Admin screens (ADMIN role required)

### Users (`/users`)

Paginated table with columns: full name, email, enabled status, locked status, roles (chips).

Admin actions per row:

- **Edit** (`UserFormDialog`): updates `firstName`, `lastName`, `email`.
- **Lock / Unlock**: calls `lockUser` or `unlockUser`. Disabled for the current user's own row
  (you cannot lock yourself out).
- **Delete**: opens `ConfirmDialog`. Disabled for the current user's own row.
- **Manage roles** (`ManageRolesDialog`): shows the user's current roles as removable chips and
  an "add role" select. Each change calls `updateUserRoles({ add: [id] })` or
  `updateUserRoles({ remove: [id] })`. After the mutation, `cache.writeFragment` updates the
  cached `UserFragment` so the chip list refreshes without re-fetching the whole user list.

### Roles (`/roles`)

Table with columns: role name, permissions (chips).

Admin actions:

- **Create / Edit** (`RoleFormDialog`): one field, `roleName`.
- **Delete**: opens `ConfirmDialog`.
- **Manage permissions** (`ManagePermissionsDialog`): same chip + select pattern as roles.
  Uses `updateRolePermissions({ add: [...], remove: [...] })`.

### Permissions (`/permissions`)

Simple table with columns: `resource`, `action`. Route: `/permissions` (top-level, not a
child of `/roles`).

Admin actions:

- **Create** (`PermissionFormDialog`): `resource` + `action` fields.
- **Delete**: opens `ConfirmDialog`.

A permission created here appears in the "add permission" select of every
`ManagePermissionsDialog`.

---

## Profile page (`/profile`)

Accessible to any authenticated user.

Displays: full name, email, account status (active/pending, locked), roles.

The **Edit profile** button opens `UpdateProfileDialog`, which calls `updateProfile`. On
success, `AuthService.updateSessionUser()` merges the returned data into the session signal
without re-fetching from the server, so the toolbar avatar and name update instantly.

---

## Key files

| File | Purpose |
|---|---|
| `src/app/core/auth/auth.ts` | Token persistence (localStorage + signals) |
| `src/app/core/auth/auth.service.ts` | Session management (login, logout, restoreSession) |
| `src/app/core/auth/auth.guard.ts` | Requires a valid session |
| `src/app/core/auth/admin-guard.ts` | Requires ADMIN role |
| `src/app/features/auth/data/auth.graphql` | Login, register, me, refreshToken, updateProfile |
| `src/app/features/auth/data/auth-feature.ts` | register, activate, resetPassword, updateProfile |
| `src/app/features/users/data/users.graphql` | UserFragment, CRUD and role assignment |
| `src/app/features/users/data/users.ts` | Users feature service |
| `src/app/features/roles/data/roles.graphql` | RoleFragment, PermissionFragment, CRUD |
| `src/app/features/roles/data/roles.ts` | Roles feature service |
