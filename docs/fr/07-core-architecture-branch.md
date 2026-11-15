# Branche : feature/core-architecture

C'est la première branche. Elle construit le squelette technique dont toutes les branches
suivantes dépendent. Aucun écran métier n'est implémenté ici ; l'objectif est d'avoir une
infrastructure fonctionnelle : un client Apollo configuré, les mécanismes d'authentification,
un pipeline de gestion des erreurs, des composants UI partagés, et une configuration
Docker + CI.

---

## Ce que vous allez apprendre

- Comment configurer Apollo Angular avec une chaîne de liens split (HTTP pour
  queries/mutations, WebSocket pour les subscriptions)
- Comment câbler un intercepteur HTTP fonctionnel pour que le token JWT soit attaché
  automatiquement
- Comment GraphQL Code Generator produit des types TypeScript à partir d'un schéma
- Comment mapper les erreurs GraphQL vers un `AppError` typé pour une gestion UI cohérente
- Comment construire un shell d'application persistant (barre d'outils, sidenav, router
  outlet) en Angular 21

---

## Ce qu'elle livre

### Le client Apollo (`apollo.config.ts`)

Le client Apollo est configuré avec trois liens chainés :

```
errorLink
   |
 split()
   |-- subscription --> GraphQLWsLink (ws://localhost:8080/graphql)
   |-- tout le reste -> HttpLink      (POST http://localhost:8080/graphql)
```

`errorLink` intercepte chaque réponse d'erreur et appelle `error-mapper.ts` pour la
convertir en `AppError`. Il s'exécute avant le split pour intercepter les erreurs des deux
transports.

`split()` examine l'opération au moment de l'exécution. Si le type de définition est
`subscription`, la requête passe par le lien WebSocket ; sinon elle passe par `HttpLink`.
Comme `HttpLink` utilise `HttpClient` d'Angular en interne, l'intercepteur d'authentification
couvre déjà les queries et mutations sans configuration supplémentaire.

### L'intercepteur d'authentification (`auth-interceptor.ts`)

Un intercepteur fonctionnel enregistré dans `app.config.ts` via
`provideHttpClient(withInterceptors([authInterceptor]))`. Il lit l'access token depuis
`AuthService` et ajoute `Authorization: Bearer <token>` à chaque requête `HttpClient`.
Comme le `HttpLink` d'Apollo utilise `HttpClient` en interne, toutes les opérations
GraphQL HTTP sont couvertes automatiquement.

### Le pipeline de génération de code

```
schema/schema.graphqls       -- copie du schéma backend (commitée)
src/**/*.graphql              -- documents GraphQL (queries, mutations, etc.)
       |
       v  npm run codegen
       v
src/app/core/graphql/generated/graphql.ts   -- GÉNÉRÉ, ne pas modifier à la main
```

`codegen.ts` à la racine du projet configure ce pipeline. Le fichier généré contient des
nœuds de document typés, des interfaces TypeScript pour chaque type GraphQL, des enums et
des types d'entrée. Il est commité pour que la CI et les clones frais n'aient pas besoin
du backend.

`npm run schema:update` télécharge le schéma le plus récent depuis le dépôt backend et
relance codegen. Exécutez cette commande quand le backend ajoute ou supprime des champs.

### Le mappeur d'erreurs (`error-mapper.ts`)

Convertit les erreurs Apollo v4 (qui utilisent `CombinedError`) en `AppError` :

- `CombinedError` avec `graphQLErrors` -> lit `extensions.classification` pour déterminer
  `ErrorKind`
- `CombinedError` avec `networkError` -> lit le code HTTP
- Statut 0 / pas de réponse -> `NETWORK`

### Le shell de l'application (`core/layout/shell/`)

Le shell est la mise en page persistante qui enveloppe chaque page authentifiée.
Il contient :

- **Barre d'outils** avec le titre de l'app, la bascule de thème et le menu déroulant de
  profil
- **Sidenav** avec les éléments de navigation groupés par rôle (tous les utilisateurs voient
  Tableau de bord, Catégories, Produits, Clients, Commandes ; les utilisateurs ADMIN voient
  en plus Utilisateurs, Rôles, Permissions)
- **`<router-outlet>`** où la page courante s'affiche

La visibilité de la section Administration est contrôlée par le signal `isAdmin()` depuis
`AuthService`. Le shell utilise `ChangeDetectionStrategy.OnPush` et lit les signals dans
le template, il ne se re-rend que quand les valeurs des signals changent.

La bascule de thème écrit `data-theme="dark"` ou `data-theme="light"` sur l'élément
`<html>` via un `effect()`. Angular Material lit cet attribut pour basculer les palettes
de couleurs.

### Composants UI partagés (`shared/ui/`)

Ces composants sont utilisés par chaque fonctionnalité. Ne dupliquez jamais leur
comportement dans un composant de fonctionnalité.

| Composant | Quand l'utiliser |
|---|---|
| `<app-loading>` | Afficher pendant que le signal `loading()` est vrai |
| `<app-error-banner [error]="..." (retry)="...">` | Afficher quand une query échoue |
| `<app-empty-state [message]="...">` | Afficher quand une query retourne une liste vide |
| `<app-page-header [title]="..." (action)="...">` | En haut de chaque page de liste |
| `<app-confirm-dialog>` | Ouvrir via `MatDialog` pour chaque action de suppression |

### Le service de notification (`core/notification/notification.ts`)

Encapsule `MatSnackBar` avec deux méthodes : `success(message)` et `error(message)`. Les
services de fonctionnalité et les pages appellent ce service plutôt que d'injecter
`MatSnackBar` directement. Cela centralise la configuration de la snackbar (durée, position).

### L'adaptateur de pagination (`shared/pagination/`)

Convertit entre le `PageEvent` de Material (index de page, taille de page) et l'enveloppe
`PageResponse` du backend (numéro de page, taille, totalElements, totalPages). Cela sort la
logique de pagination des composants de page individuels.

### Docker et CI

**`Dockerfile`** -- build en deux étapes :
1. Image Node 22 : `npm ci` + `npm run build`
2. Image nginx : copie `dist/`, applique `nginx.conf`

**`nginx.conf`** -- proxifie `/graphql` (HTTP et WebSocket) vers le backend et sert
l'application Angular SPA avec le fallback HTML5 history.

**`docker-compose.yml`** -- démarre le conteneur frontend. Attend le backend sur
`host.docker.internal:8080`.

**`.github/workflows/ci.yml`** -- s'exécute à chaque push et pull request : install, lint,
test, build. Les quatre étapes doivent passer avant qu'une PR puisse être mergée.

---

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/app/app.config.ts` | Providers racine (router, HttpClient, Apollo, APP_INITIALIZER) |
| `src/app/app.routes.ts` | Routes lazy de haut niveau |
| `src/app/core/graphql/apollo.config.ts` | Configuration du client Apollo |
| `src/app/core/graphql/error-mapper.ts` | Normalisation des erreurs |
| `src/app/core/graphql/ws-client.ts` | Client WebSocket pour les subscriptions |
| `src/app/core/auth/auth.ts` | Persistance du token |
| `src/app/core/auth/auth.service.ts` | Gestion de session |
| `src/app/core/auth/auth-interceptor.ts` | Injection JWT dans les requêtes HTTP |
| `src/app/core/layout/shell/shell.ts` | Mise en page persistante |
| `schema/schema.graphqls` | Schéma backend (source de vérité pour codegen) |
| `codegen.ts` | Configuration de la génération de code |
