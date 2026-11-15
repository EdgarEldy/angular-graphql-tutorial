# Authentification et contrôle d'accès (RBAC)

L'authentification dans ce projet utilise des JWT (JSON Web Tokens). Le backend émet un
token à la connexion ; le frontend le stocke, l'attache à chaque requête, et lit les rôles
et permissions de l'utilisateur directement dans le payload du token -- sans faire d'appel
API séparé à `/me` sur chaque page.

---

## Comment fonctionne l'authentification JWT

1. L'utilisateur soumet son email et son mot de passe sur la page de connexion.
2. Le backend vérifie les identifiants et retourne un `accessToken` et un `refreshToken`.
3. Le frontend stocke les deux tokens dans `localStorage`.
4. Pour chaque requête GraphQL suivante (HTTP ou WebSocket), le frontend inclut l'access
   token dans l'en-tête `Authorization` : `Authorization: Bearer <accessToken>`.
5. Le backend valide le token à chaque requête et lit l'identité et les rôles de
   l'utilisateur depuis celui-ci.
6. Quand l'access token expire, le frontend utilise le refresh token pour en obtenir un
   nouveau sans demander à l'utilisateur de se reconnecter.

Le payload du token (la partie entre les deux points dans un JWT, encodée en base-64)
contient l'id, l'email, les rôles et les permissions de l'utilisateur. La fonction dans
`src/app/core/auth/auth.ts` décode ce payload -- elle ne vérifie pas la signature, car
la vérification de signature est le rôle du backend.

---

## Stockage du token (`auth.ts`)

`src/app/core/auth/auth.ts` est un utilitaire léger qui lit et écrit les tokens dans
`localStorage` et les expose comme signals. Il ne contient pas de logique métier.

```typescript
// Ce qu'il fait, conceptuellement :
getToken()         -> string | null    lit l'access token depuis localStorage
getRefreshToken()  -> string | null    lit le refresh token depuis localStorage
setTokens(access, refresh)             écrit les deux tokens
clearTokens()                          supprime les deux tokens (appelé à la déconnexion)
decodePayload(token)  -> JwtPayload    décode le corps du token en base-64, sans vérif signature
```

> **Pourquoi localStorage ?** `sessionStorage` déconnecterait l'utilisateur à chaque
> fermeture d'onglet, ce qui est peu pratique. Un cookie `HttpOnly` empêcherait l'accès XSS
> mais nécessiterait une configuration CORS sur le backend. Pour un projet tutoriel,
> localStorage maintient l'implémentation simple et visible.

---

## Les signals de session (`auth.service.ts`)

`src/app/core/auth/auth.service.ts` possède l'état de session à l'échelle de l'application.
Il expose des signals calculés que les composants et les guards consomment :

```typescript
isAuthenticated  // true quand un token valide est présent
currentUser      // le payload JWT décodé (nom, email, rôles, permissions)
isAdmin          // true quand l'utilisateur a le rôle ADMIN
roles            // string[] -- les noms de rôles de l'utilisateur
permissions      // string[] -- les noms de permissions de l'utilisateur
```

**Pourquoi des signals ?** Les signals Angular sont synchrones et réactifs. Un composant qui
lit `authService.isAuthenticated()` dans un template se re-rendera automatiquement quand la
valeur change (par ex. après connexion ou déconnexion), sans le boilerplate d'un `AsyncPipe`
ni la gestion du cycle de vie des abonnements.

---

## Restauration de session au démarrage (`APP_INITIALIZER`)

Quand l'utilisateur recharge la page, l'application Angular repart de zéro. Sans traitement
spécial, l'app afficherait brièvement la page de connexion avant que les guards aient eu la
chance de vérifier le token sauvegardé dans localStorage.

`app.config.ts` enregistre un `APP_INITIALIZER` :

```typescript
{
  provide: APP_INITIALIZER,
  useFactory: (auth: AuthService) => () => auth.restoreSession(),
  deps: [AuthService],
  multi: true,
}
```

Angular exécute tous les `APP_INITIALIZER` et attend leur complétion avant de traiter toute
route. `restoreSession()` lit le token depuis localStorage, le décode, et peuple les signals
de session. Au moment où le router évalue `authGuard`, les signals reflètent déjà l'état
réel de la session.

---

## L'intercepteur d'authentification

`src/app/core/auth/auth-interceptor.ts` est un intercepteur HTTP fonctionnel enregistré via
`provideHttpClient(withInterceptors([authInterceptor]))` dans `app.config.ts`.

Pour chaque requête `HttpClient`, il vérifie si un token est présent. Si oui, il clone la
requête et ajoute l'en-tête `Authorization: Bearer` :

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  if (!token) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
```

**Pourquoi cela couvre-t-il GraphQL ?** Le `HttpLink` d'Apollo utilise `HttpClient` en
interne. Chaque query et mutation passe par `HttpClient`, donc l'intercepteur attache
automatiquement le token. Les subscriptions passent par WebSocket et sont gérées séparément
via `connectionParams` dans `ws-client.ts`.

---

## Les guards de route

Deux guards protègent les routes qui nécessitent une authentification ou le rôle ADMIN.

### `authGuard`

Situé dans `src/app/core/auth/auth.guard.ts`. Redirige vers `/auth/login` (avec un paramètre
de requête `returnUrl`) si `authService.isAuthenticated()` retourne false. Enregistré sur la
route parente qui englobe toutes les pages protégées dans `app.routes.ts`.

### `adminGuard`

Situé dans `src/app/core/auth/admin-guard.ts`. Redirige vers `/dashboard` si
`authService.isAdmin()` retourne false. Enregistré sur la route parente qui englobe `/users`,
`/roles` et `/permissions`.

```typescript
// app.routes.ts (simplifié)
{
  path: '',
  canActivate: [authGuard],  // doit être connecté
  children: [
    { path: 'dashboard', ... },
    { path: 'categories', loadChildren: () => ... },
    {
      path: '',
      canActivate: [adminGuard],  // doit aussi être ADMIN
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

## Directives de visibilité dans les templates

Pour les éléments UI qui ne doivent apparaître qu'aux admins (boutons "Nouveau", actions
"Supprimer"), utilisez les directives structurelles `appHasRole` et `appHasPermission` :

```html
<!-- Afficher uniquement aux utilisateurs avec le rôle ADMIN -->
<button *appHasRole="'ADMIN'" mat-flat-button (click)="openCreate()">
  Nouvelle catégorie
</button>

<!-- Afficher uniquement aux utilisateurs avec une permission spécifique -->
<button *appHasPermission="'PRODUCT:DELETE'" mat-icon-button (click)="delete(row)">
  <mat-icon>delete</mat-icon>
</button>
```

Ces directives lisent les signals de session et ajoutent ou retirent l'élément du DOM.
Elles ne font pas d'appels API.

---

## Rafraîchissement du token

Quand l'access token expire, la prochaine requête GraphQL retourne une erreur 401. Le lien
d'erreur (`error-mapper.ts`) détecte le type `UNAUTHENTICATED` et appelle
`AuthService.refreshAccessToken()`, qui envoie le refresh token au backend et stocke le
nouvel access token. L'opération échouée est alors relancée avec le nouveau token.

Si le refresh token lui-même est expiré, l'utilisateur est redirigé vers `/auth/login`.

---

## Structure de route pour les écrans RBAC

L'écran des permissions est à la route de haut niveau `/permissions`, pas sous
`/roles/permissions`. Cela correspond à l'élément de navigation dans la sidebar. Le
composant `PermissionListPage` est chargé de façon lazy comme composant standalone dans
`app.routes.ts`, pas comme enfant des routes des rôles.
