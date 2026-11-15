# Architecture

Comprendre la structure générale avant de plonger dans le code évite la confusion sur où
placer les choses et pourquoi les couches sont séparées comme elles le sont.

---

## Le flux d'une requête

Chaque donnée affichée par l'application emprunte le même chemin :

```
Composant
  |
  | appelle une méthode sur
  v
Service de fonctionnalité  (src/app/features/<nom>/data/<nom>.ts)
  |
  | appelle Apollo.query() / .mutate() / .watchQuery()
  v
Chaîne de liens Apollo  (src/app/core/graphql/apollo.config.ts)
  |
  +-- authInterceptor  ajoute "Authorization: Bearer <token>" à chaque requête HTTP
  |
  +-- errorLink        intercepte les erreurs GraphQL et réseau, les convertit en AppError
  |
  +-- split()          envoie les subscriptions vers GraphQLWsLink, le reste vers HttpLink
  |
  v
Backend Spring GraphQL  (POST http://localhost:8080/graphql  ou  WS ws://localhost:8080/graphql)
```

**Pourquoi ce découpage en couches ?**

- Le **composant** ne connaît que son service de fonctionnalité. Il n'importe jamais Apollo
  directement. Cela signifie qu'on peut tester un composant en fournissant un simple mock
  du service -- pas besoin d'Apollo.
- Le **service de fonctionnalité** possède les documents GraphQL pour une ressource
  (categories, products, etc.) et traduit les réponses Apollo en objets du domaine typés.
  Il ne touche jamais à l'interface utilisateur.
- La **chaîne de liens** est une infrastructure transversale : l'authentification, la
  normalisation des erreurs et le choix du transport se font une seule fois, au même endroit,
  pour toutes les opérations de l'application.

---

## Structure des dossiers

```
src/app/
├── app.ts                   Composant racine -- juste un <router-outlet>
├── app.config.ts            Providers de démarrage : router, HttpClient, Apollo, APP_INITIALIZER
├── app.routes.ts            Routes de haut niveau (lazy-loaded par fonctionnalité)
│
├── core/                    Infrastructure -- singleton, jamais spécifique à une fonctionnalité
│   ├── graphql/
│   │   ├── apollo.config.ts         Construit et exporte le client Apollo
│   │   ├── error-mapper.ts          Convertit les erreurs Apollo brutes en AppError
│   │   ├── ws-client.ts             Crée le client WebSocket (subscriptions)
│   │   └── generated/
│   │       └── graphql.ts           GÉNÉRÉ -- ne pas modifier à la main
│   ├── auth/
│   │   ├── auth.ts                  Lecture/écriture du token dans localStorage + signals
│   │   ├── auth.service.ts          Gestion de session (login, logout, restoreSession)
│   │   ├── auth.guard.ts            Redirige les utilisateurs non authentifiés vers /auth/login
│   │   ├── admin-guard.ts           Redirige les non-admins vers /dashboard
│   │   └── auth-interceptor.ts      Injecte le Bearer token dans chaque requête HttpClient
│   ├── notification/
│   │   └── notification.ts          Encapsule MatSnackBar : méthodes success() et error()
│   └── layout/
│       └── shell/                   Chrome persistant : barre d'outils, sidenav, router-outlet
│
├── shared/                  UI réutilisable -- non liée à un domaine
│   ├── ui/
│   │   ├── confirm-dialog/          "Êtes-vous sûr ?" utilisé par toutes les suppressions
│   │   ├── page-header/             Titre + bouton d'action optionnel en haut d'une page
│   │   ├── empty-state/             Illustration quand une liste est vide
│   │   ├── loading/                 Spinner affiché pendant le chargement des données
│   │   └── error-banner/            Message d'erreur + bouton Réessayer
│   └── pagination/
│       └── paginator-adapter.ts     Convertit PageEvent de Material en page/size backend
│
└── features/                Un dossier par domaine métier
    ├── auth/                Login, inscription, activation, mot de passe oublié/réinitialisation, profil
    ├── users/               Administration des utilisateurs (admin uniquement)
    ├── roles/               Administration des rôles + liste des permissions (admin uniquement)
    ├── categories/          CRUD des catégories
    ├── products/            CRUD des produits avec filtres
    ├── customers/           CRUD des clients + détail client
    └── orders/              CRUD des commandes + subscription en temps réel
```

Chaque dossier de fonctionnalité suit toujours la même organisation interne :

```
features/<nom>/
  <nom>.routes.ts       Définitions de routes lazy-loaded pour ce domaine
  data/
    <nom>.graphql       Documents GraphQL (queries, mutations, fragments, subscriptions)
    <nom>.ts            Service Apollo : une méthode par opération, aucune logique UI
    <nom>.spec.ts       Tests unitaires du service
  pages/                Composants intelligents routés (récupèrent les données, ouvrent les dialogs)
  dialogs/              Formulaires de création/modification ouverts avec MatDialog
  components/           Composants de présentation (muets), sans injection de service
```

---

## Décisions d'architecture clés

### Composants intelligents vs. composants muets

Les **pages** sont intelligentes : elles injectent le service de fonctionnalité, maintiennent
les signaux loading/error/empty, et orchestrent les dialogs. Les **dialogs et composants de
présentation** sont muets : ils reçoivent des données via `input()` et communiquent via
`output()`. Cette séparation permet de tester un dialog en lui fournissant simplement des
données d'entrée -- pas de service, de router, ni d'Apollo nécessaires.

### Les services ne touchent jamais à l'UI

Un service de fonctionnalité (`categories.ts`, `products.ts`, etc.) retourne des `Observable`.
Il n'appelle jamais `MatSnackBar`, ne navigue jamais avec `Router.navigate()`, et n'ouvre
jamais de `MatDialog`. Ces décisions appartiennent au composant. Cette règle simplifie les
tests : un `TestBed` avec `provideHttpClient` suffit.

### Les composants n'injectent jamais Apollo directement

Un composant qui injecte `Apollo` devient difficile à tester et enfreint la convention selon
laquelle Apollo est un détail d'implémentation de la couche service. Chaque composant appelle
les méthodes de son service de fonctionnalité. Le seul endroit qui importe depuis
`@apollo/client` ou `apollo-angular` est le service lui-même (et `apollo.config.ts`).

### APP_INITIALIZER pour restaurer la session

`app.config.ts` enregistre un `APP_INITIALIZER` qui appelle `AuthService.restoreSession()`.
Angular exécute chaque `APP_INITIALIZER` et attend sa complétion avant de traiter la première
navigation du router. Cela garantit que chaque guard de route (`authGuard`, `adminGuard`) voit
l'état de session réel dès la toute première requête, sans bref passage par un état null qui
redirigerait un utilisateur connecté vers la page de login lors d'un rechargement.

### Les types générés comme source de vérité unique

`schema/schema.graphqls` est une copie du schéma backend (téléchargeable avec
`npm run schema:update`). `codegen.ts` lit ce fichier et chaque document `*.graphql` dans
`src/` et écrit `src/app/core/graphql/generated/graphql.ts`. Ce fichier contient :

- Des interfaces TypeScript pour chaque type GraphQL (`User`, `Product`, `Order`, etc.)
- Des nœuds de document typés pour chaque query, mutation et subscription
- Des enums et types d'entrée

Le fichier généré est commité dans git pour que les builds CI et les clones frais n'aient
pas besoin du backend en cours d'exécution. Ne le modifiez jamais à la main ; lancez
`npm run codegen` après tout changement de schéma ou de document.

### Lazy loading pour chaque fonctionnalité

Chaque fonctionnalité n'est chargée que lorsque l'utilisateur y navigue. `app.routes.ts`
utilise `loadChildren` pour chaque route. Cela maintient le bundle initial léger et signifie
qu'un utilisateur ADMIN qui ne visite jamais `/categories` ne télécharge jamais le code
des catégories.
