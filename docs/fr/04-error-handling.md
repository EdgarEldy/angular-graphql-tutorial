# Gestion des erreurs

La gestion des erreurs en GraphQL est différente de REST. En REST, une erreur signifie
toujours un code HTTP >= 400. En GraphQL, le serveur retourne toujours HTTP 200, même
quand quelque chose a mal tourné -- les erreurs se trouvent dans le corps de la réponse,
dans un tableau `errors` aux côtés du champ `data`. Ce projet normalise les erreurs
GraphQL et les erreurs réseau en un seul type pour que les composants n'aient jamais besoin
de savoir lequel ils ont reçu.

---

## Le type AppError

Chaque erreur dans l'application est représentée comme un `AppError` :

```typescript
interface AppError {
  kind: ErrorKind;   // quel type de problème
  status: number;    // le code HTTP (0 pour les erreurs réseau)
  message: string;   // le message utilisateur provenant du backend
  fieldErrors?: Record<string, string[]>; // erreurs de validation par champ (kind VALIDATION)
}

type ErrorKind =
  | 'VALIDATION'      // 400 -- entrée invalide, fieldErrors renseigné
  | 'UNAUTHENTICATED' // 401 -- token manquant ou expiré
  | 'FORBIDDEN'       // 403 -- authentifié mais non autorisé
  | 'NOT_FOUND'       // 404 -- l'entité n'existe pas
  | 'CONFLICT'        // 409 -- nom en doublon, etc.
  | 'BUSINESS_RULE'   // 422 -- contrainte du domaine (supprimer une catégorie avec des produits, etc.)
  | 'SERVER'          // 5xx -- erreur serveur inattendue
  | 'NETWORK';        // 0   -- impossible d'atteindre le serveur
```

---

## Le mappeur d'erreurs (`error-mapper.ts`)

`src/app/core/graphql/error-mapper.ts` convertit une erreur Apollo brute en `AppError`.
Apollo v4 encapsule les erreurs dans un objet `CombinedError` ; le mappeur l'inspecte :

```
CombinedError
  |
  +-- a des graphQLErrors ?  -> lire extensions.classification + extensions.status
  |                             le message vient de error.message
  +-- a un networkError ?    -> si ServerError, lire le code HTTP et le corps
  |                             si pas de réponse (hors ligne), status = 0 -> NETWORK
  +-- plain Error            -> NETWORK
```

Le champ `classification` dans `extensions` est défini par la gestion des erreurs Spring for
GraphQL du backend et se mappe directement sur `ErrorKind` :

| Classification backend | ErrorKind AppError |
|---|---|
| `BAD_REQUEST` | `VALIDATION` (400) |
| `UNAUTHORIZED` | `UNAUTHENTICATED` (401) |
| `FORBIDDEN` | `FORBIDDEN` (403) |
| `NOT_FOUND` | `NOT_FOUND` (404) |
| `CONFLICT` | `CONFLICT` (409) |
| `BUSINESS_RULE` | `BUSINESS_RULE` (422) |
| `INTERNAL_ERROR` | `SERVER` (500) |
| (pas de réponse) | `NETWORK` (0) |

---

## Le lien d'erreur

Le lien d'erreur se trouve au début de la chaîne de liens Apollo. Il intercepte chaque
réponse d'erreur avant qu'elle n'atteigne le service appelant et la convertit :

```typescript
// apollo.config.ts (simplifié)
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  const appError = mapToAppError(graphQLErrors, networkError);
  operation.setContext({ appError });
  return forward(operation);
});
```

Les services reçoivent l'`AppError` depuis le contexte de l'opération et la relancent comme
erreur d'observable typée pour que les composants puissent la gérer dans
`.subscribe({ error: ... })` ou avec `catchError`.

---

## Comportement UI par type d'erreur

Chaque `ErrorKind` a un comportement UI standard. Cette cohérence est importante : un étudiant
doit toujours savoir ce qui se passe quand un 403 arrive, quel que soit l'écran actif.

| Type | Comportement UI |
|---|---|
| `VALIDATION` | Afficher les `fieldErrors` en ligne sur le champ du formulaire concerné |
| `UNAUTHENTICATED` | Vider la session, rediriger vers `/auth/login?returnUrl=<actuel>` |
| `FORBIDDEN` | Afficher le message backend dans une snackbar (couleur erreur) |
| `NOT_FOUND` | Afficher la bannière d'erreur avec un bouton Réessayer |
| `CONFLICT` | Afficher le message backend en ligne dans le dialog, garder le dialog ouvert |
| `BUSINESS_RULE` | Afficher le message backend en ligne dans le dialog, garder le dialog ouvert |
| `SERVER` | Afficher la bannière d'erreur avec un bouton Réessayer |
| `NETWORK` | Afficher la bannière d'erreur avec un bouton Réessayer |

**Exception :** un 401 de `POST /auth/login` est affiché en ligne dans le formulaire
(mauvais identifiants), pas comme une redirection vers la page de connexion (qui est le
comportement standard des 401 partout ailleurs). Le service détecte ce cas en vérifiant
le nom de l'opération avant de déclencher la redirection.

---

## Le pattern des trois états

Chaque page de liste ou de détail a exactement trois états explicites. En utilisant les
signals Angular :

```typescript
loading  = signal(false);
error    = signal<AppError | null>(null);
items    = signal<Item[]>([]);
```

Le template utilise `@if` pour afficher le bon état :

```html
@if (loading()) {
  <app-loading />
} @else if (error()) {
  <app-error-banner [error]="error()!" (retry)="load()" />
} @else if (items().length === 0) {
  <app-empty-state message="Aucun élément trouvé." />
} @else {
  <!-- le tableau de données -->
}
```

Ce pattern élimine l'erreur courante d'afficher un écran blanc quand une query échoue ou
ne retourne aucun résultat. Chaque écran a un état explicite pour chaque issue possible.

---

## Réponses partielles

Quand `errorPolicy: 'all'` est défini sur une query, Apollo transmet à la fois `data` et
`errors` à l'abonné. Le service journalise les erreurs (pour le débogage) et retourne les
données partielles au composant. Le composant affiche ce qu'il a et affiche la bannière
d'erreur en dessous. C'est mieux que de n'afficher rien quand une seule partie d'une query
complexe échoue.
