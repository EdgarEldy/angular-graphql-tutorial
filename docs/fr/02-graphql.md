# GraphQL et Apollo

Ce projet utilise [Apollo Angular](https://the-guild.dev/graphql/apollo-angular) comme
client GraphQL et [GraphQL Code Generator](https://the-guild.dev/graphql/codegen) pour
produire des types TypeScript à partir du schéma. Ce document explique comment les deux
fonctionnent ensemble et les patterns que la base de code suit.

---

## Qu'est-ce que GraphQL ?

GraphQL est un langage de requête pour les API. Au lieu de multiples endpoints REST
(`GET /categories`, `GET /categories/1/products`, etc.), une API GraphQL expose un unique
endpoint (`POST /graphql`) qui accepte un document décrivant exactement les données dont
le client a besoin. Le serveur retourne uniquement ces champs -- ni plus, ni moins.

Trois types de documents existent :

| Type | Rôle | Transport HTTP |
|---|---|---|
| `query` | Lire des données | POST |
| `mutation` | Écrire des données (créer, modifier, supprimer) | POST |
| `subscription` | Recevoir un flux d'événements | WebSocket |

---

## La chaîne de liens Apollo

Apollo envoie chaque opération à travers une chaîne de **liens** avant qu'elle n'atteigne
le serveur. Pensez aux liens comme à des middlewares. La chaîne dans
`src/app/core/graphql/apollo.config.ts` est :

```
Chaque opération
      |
      v
  errorLink         Intercepte les erreurs, les convertit en AppError
      |
      v
   split()          Examine le type d'opération
      |             Si c'est une subscription -> GraphQLWsLink (WebSocket)
      |             Sinon                     -> HttpLink      (HTTP POST)
      v
  HttpLink / GraphQLWsLink
      |
      v
  Backend Spring GraphQL
```

**errorLink** est un lien `onError` de `@apollo/client/link/error`. Il s'exécute chaque fois
qu'Apollo reçoit une réponse contenant des erreurs GraphQL ou un échec réseau. Il convertit
l'erreur brute en `AppError` typée et la relance pour que le service appelant puisse la
gérer.

**split()** examine chaque opération au moment de l'exécution. Une opération de type
`subscription` va vers le lien WebSocket ; tout le reste va vers le lien HTTP. C'est pourquoi
les queries et mutations passent par `HttpClient` (et reçoivent automatiquement l'intercepteur
d'authentification) tandis que les subscriptions passent par la connexion WebSocket (et
transmettent le token via `connectionParams`).

---

## La génération de code

Écrire des documents GraphQL à la main et dupliquer les formes dans des interfaces TypeScript
créerait une charge de maintenance et une source de divergence de types. Code Generator
élimine cela en lisant le schéma et tous les fichiers `*.graphql` pour produire un unique
fichier TypeScript avec tout ce qui est typé.

```
schema/schema.graphqls       Le schéma backend (ne jamais modifier à la main)
src/**/*.graphql              Les documents GraphQL écrits pour chaque fonctionnalité
        |
        v  npm run codegen
        v
src/app/core/graphql/generated/graphql.ts
```

Le fichier généré contient :

- Des **interfaces** pour chaque type (`UserFragment`, `ProductFragment`, etc.)
- Des **nœuds de document typés** pour chaque query, mutation et subscription
  (`GetCategoriesDocument`, `CreateCategoryDocument`, etc.)
- Des **enums** (`OrderStatus`, `UserRole`, etc.)
- Des **types d'entrée** (`CreateCategoryInput`, `UpdateProductInput`, etc.)

Importez toujours depuis `graphql.ts` dans vos services, ne définissez jamais la même forme
manuellement. Le fichier est commité dans git pour que la CI tourne sans le backend.

**Quand lancer codegen :**

- Après avoir créé ou modifié un fichier `*.graphql`.
- Après avoir exécuté `npm run schema:update` (qui télécharge un nouveau schéma depuis le backend).
- Après avoir tiré des modifications qui modifient le schéma ou un document.

---

## Les fragments

Un **fragment** est un ensemble de sélection nommé et réutilisable. Plutôt que de répéter
la même liste de champs dans chaque query et mutation, vous définissez un fragment une fois
et vous l'utilisez partout.

```graphql
# Défini une fois dans categories.graphql
fragment CategoryFields on Category {
  id
  categoryName
}

# Utilisé dans les queries
query GetCategories($page: Int, $size: Int) {
  categories(page: $page, size: $size) {
    content { ...CategoryFields }
    totalElements
    totalPages
  }
}

# Utilisé dans les mutations -- la réponse utilise aussi le fragment
mutation CreateCategory($input: CreateCategoryInput!) {
  createCategory(input: $input) { ...CategoryFields }
}
```

Cela est important pour le cache Apollo : Apollo normalise les objets mis en cache par
`__typename + id`. Quand la réponse d'une mutation contient le même fragment que la query
qui a peuplé la liste, Apollo reconnaît l'objet retourné et met à jour la version en cache
automatiquement, pour que l'UI reflète le changement sans requête supplémentaire.

Les fragments utilisés dans ce projet :

| Fragment | Défini dans | Utilisé pour |
|---|---|---|
| `CategoryFields` | `categories.graphql` | Liste et dialogs de catégories |
| `ProductFields` | `products.graphql` | Liste et dialogs de produits |
| `CustomerFields` | `customers.graphql` | Liste et dialogs de clients |
| `OrderFields` | `orders.graphql` | Liste et dialogs de commandes |
| `OrderItemFields` | `orders.graphql` | Tableau des articles de commande |
| `UserFragment` | `users.graphql` | Gestion des utilisateurs |
| `RoleFragment` | `roles.graphql` | Gestion des rôles |
| `PermissionFragment` | `roles.graphql` | Gestion des permissions |
| `AuthPayloadFields` | `auth.graphql` | Réponses de login et de rafraîchissement de token |

---

## Stratégies de mise à jour du cache

Le cache `InMemoryCache` d'Apollo stocke chaque objet qu'il a vu, indexé par
`__typename + id`. Après une mutation, le cache peut être obsolète. Le projet utilise
deux stratégies :

### Mise à jour automatique (pour les mutations qui retournent l'entité modifiée)

Quand une mutation `updateCategory` retourne un fragment `CategoryFields`, Apollo reconnaît
l'`id` et met à jour l'entrée en cache automatiquement. Toute query qui incluait cette
catégorie dans son résultat retourne maintenant la valeur mise à jour. Aucun code
supplémentaire n'est nécessaire.

### Mise à jour manuelle avec `cache.evict` (pour les suppressions)

Quand une entité est supprimée, le serveur ne retourne rien (ou juste l'id supprimé).
Apollo ne sait pas supprimer l'entité du cache. Le service appelle :

```typescript
cache.evict({ id: cache.identify(deletedEntity) });
cache.gc(); // garbage-collect les références orphelines
```

### Refetch queries (pour les créations où la pagination est importante)

Quand une nouvelle entité est créée, le nombre total et les affectations de pages changent.
La stratégie la plus simple est de refaire la query de liste :

```typescript
this.apollo.mutate({
  mutation: CreateCategoryDocument,
  variables: { input },
  refetchQueries: [{ query: GetCategoriesDocument, variables: { page: 0, size: 10 } }],
});
```

---

## Subscriptions et WebSocket

La subscription `orderCreated` illustre les mises à jour en temps réel. La connexion
WebSocket est établie par `GraphQLWsLink` en utilisant le protocole `graphql-ws`.

Le token est transmis au moment de la connexion via `connectionParams` :

```typescript
// ws-client.ts
connectionParams: () => {
  const token = auth.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

Cela signifie que la connexion WebSocket est authentifiée. Si le token expire pendant que
la connexion est ouverte, le client appelle `reconnect()` après un rafraîchissement du token.

Dans un composant, souscrivez et nettoyez avec `takeUntilDestroyed()` :

```typescript
private destroyRef = inject(DestroyRef);

ngOnInit(): void {
  this.ordersService.watchOrderCreated()
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(order => this.newOrderCount.update(n => n + 1));
}
```

`takeUntilDestroyed` se désabonne automatiquement quand le composant est détruit, évitant
les fuites mémoire sans `ngOnDestroy` manuel.
