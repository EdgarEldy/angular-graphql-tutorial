# Authentication and RBAC

Authentication in this project uses JWTs (JSON Web Tokens). The backend issues a token at
login; the frontend stores it, attaches it to every request, and reads the user's roles and
permissions directly from the token payload -- without making a separate `/me` API call on
every page.

---

## How JWT authentication works

1. The user submits their email and password on the login page.
2. The backend verifies the credentials and returns an `accessToken` and a `refreshToken`.
3. The frontend stores both tokens in `localStorage`.
4. For every subsequent GraphQL request (HTTP or WebSocket), the frontend includes the access
   token in the `Authorization` header: `Authorization: Bearer <accessToken>`.
5. The backend validates the token on each request and reads the user's identity and roles
   from it.
6. When the access token expires, the frontend uses the refresh token to obtain a new one
   without asking the user to log in again.

The token payload (the part between the two dots in a JWT, base-64 encoded) contains the
user's id, email, roles, and permissions. The function in `src/app/core/auth/auth.ts`
decodes this payload -- it does not verify the signature, since signature verification is
the backend's job.

---

## Token storage (`auth.ts`)

`src/app/core/auth/auth.ts` is a thin utility that reads and writes tokens in `localStorage`
and exposes them as signals. It does not contain business logic.

```typescript
// What it does, conceptually:
getToken()         -> string | null    reads the access token from localStorage
getRefreshToken()  -> string | null    reads the refresh token from localStorage
setTokens(access, refresh)             writes both tokens
clearTokens()                          removes both tokens (called on logout)
decodePayload(token)  -> JwtPayload    base-64 decodes the token body, no signature check
```

> **Why localStorage?** `sessionStorage` would log the user out every time they close the
> tab, which is inconvenient. An `HttpOnly` cookie would prevent XSS access but requires
> CORS configuration on the backend. For a tutorial project, localStorage keeps the
> implementation simple and visible.

---

## Session signals (`auth.service.ts`)

`src/app/core/auth/auth.service.ts` owns the application-wide session state. It exposes
computed signals that components and guards consume:

```typescript
isAuthenticated  // true when a valid token is present
currentUser      // the decoded JWT payload (name, email, roles, permissions)
isAdmin          // true when the user has the ADMIN role
roles            // string[] -- the user's role names
permissions      // string[] -- the user's permission names
```

**Why signals?** Angular signals are synchronous and reactive. A component that reads
`authService.isAuthenticated()` in a template will re-render automatically when the value
changes (e.g. after login or logout), without the boilerplate of an `AsyncPipe` and without
managing subscription lifecycles.

---

## Session restore on startup (`APP_INITIALIZER`)

When the user refreshes the page, the Angular app starts fresh. Without special handling,
the app would briefly show the login page before guards have had a chance to check
localStorage for a saved token.

`app.config.ts` registers an `APP_INITIALIZER`:

```typescript
{
  provide: APP_INITIALIZER,
  useFactory: (auth: AuthService) => () => auth.restoreSession(),
  deps: [AuthService],
  multi: true,
}
```

Angular runs all `APP_INITIALIZER` functions and waits for them to complete before it
processes any route. `restoreSession()` reads the token from localStorage, decodes it, and
populates the session signals. By the time the router evaluates `authGuard`, the signals
already reflect the real session state.

---

## The auth interceptor

`src/app/core/auth/auth-interceptor.ts` is a functional HTTP interceptor registered via
`provideHttpClient(withInterceptors([authInterceptor]))` in `app.config.ts`.

For every `HttpClient` request it checks whether a token is present. If it is, it clones the
request and adds the `Authorization: Bearer` header:

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  if (!token) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
```

**Why does this cover GraphQL?** Apollo's `HttpLink` uses Angular's `HttpClient` internally.
Every query and mutation goes through `HttpClient`, so the interceptor automatically attaches
the token. Subscriptions go through WebSocket and are handled separately via
`connectionParams` in `ws-client.ts`.

---

## Route guards

Two guards protect routes that require authentication or the ADMIN role.

### `authGuard`

Located at `src/app/core/auth/auth.guard.ts`. Redirects to `/auth/login` (with a `returnUrl`
query param) if `authService.isAuthenticated()` returns false. Registered on the parent
route that wraps all protected pages in `app.routes.ts`.

### `adminGuard`

Located at `src/app/core/auth/admin-guard.ts`. Redirects to `/dashboard` if
`authService.isAdmin()` returns false. Registered on the parent route that wraps `/users`,
`/roles`, and `/permissions`.

```typescript
// app.routes.ts (simplified)
{
  path: '',
  canActivate: [authGuard],  // must be logged in
  children: [
    { path: 'dashboard', ... },
    { path: 'categories', loadChildren: () => ... },
    {
      path: '',
      canActivate: [adminGuard],  // must also be ADMIN
      children: [
        { path: 'users', loadChildren: () => ... },
        { path: 'roles', loadChildren: () => ... },
        { path: 'permissions', loadComponent: () => ... },
      ],
    },
  ],
},
```

---

## Template visibility directives

For UI elements that should only appear for admins (e.g. "New" buttons, "Delete" actions),
use the `appHasRole` and `appHasPermission` structural directives:

```html
<!-- Show only to users with the ADMIN role -->
<button *appHasRole="'ADMIN'" mat-flat-button (click)="openCreate()">New category</button>

<!-- Show only to users with a specific permission -->
<button *appHasPermission="'PRODUCT:DELETE'" mat-icon-button (click)="delete(row)">
  <mat-icon>delete</mat-icon>
</button>
```

These directives read the session signals and add or remove the element from the DOM. They
do not make API calls.

---

## Token refresh

When the access token expires, the next GraphQL request returns a 401 error. The error link
(`error-mapper.ts`) detects the `UNAUTHENTICATED` kind and calls
`AuthService.refreshAccessToken()`, which sends the refresh token to the backend and stores
the new access token. The failed operation is then retried with the new token.

If the refresh token itself is expired, the user is redirected to `/auth/login`.

---

## Route structure for RBAC screens

The permissions screen is at the top-level route `/permissions`, not `/roles/permissions`.
This matches the sidebar navigation item. The `PermissionListPage` component is loaded
lazily as a standalone component in `app.routes.ts`, not as a child of the roles routes.
