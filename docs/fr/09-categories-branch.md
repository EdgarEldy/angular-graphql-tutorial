# Branche : feature/categories

C'est la première branche de CRUD complète. Elle établit les patterns que les produits,
les clients et les commandes répètent tous. Si vous comprenez comment les catégories
fonctionnent, vous comprenez comment chaque autre fonctionnalité de liste fonctionne.

---

## Ce que vous allez apprendre

- Le pattern CRUD standard pour une liste paginée (query, créer, modifier, supprimer)
- Comment ouvrir un `MatDialog` et lui passer des données
- Comment mettre à jour le cache Apollo après des mutations de création, modification et
  suppression
- Comment gérer une erreur `BUSINESS_RULE` (suppression bloquée par le backend)
- Comment partager une query entre plusieurs fonctionnalités avec `CategoryOptions`

---

## Écrans

### Liste des catégories (`/categories`)

Un `MatTable` paginé avec une seule colonne : `categoryName`. Contrôles de pagination en bas
de page avec le paginateur d'Angular Material.

**Ce que voient les admins :** un bouton "Nouvelle catégorie" dans l'en-tête de page, et
des boutons "Modifier" et "Supprimer" sur chaque ligne. Ces éléments sont masqués aux
utilisateurs non-admin via la directive `*appHasRole`.

**Ce que voient les utilisateurs non-admin :** uniquement le tableau, en lecture seule.

### Dialog de création/modification (`CategoryFormDialog`)

Un `MatDialog` avec un seul champ de formulaire : `categoryName` (requis,
`mat-form-field appearance="outline"`). Le même dialog est utilisé pour la création (sans
données initiales) et la modification (pré-rempli avec le `categoryName` de la ligne).

La page parente détecte quel cas s'applique en vérifiant si `MatDialogRef.close()` a été
appelé avec une entité. Si oui, elle re-fetche la liste (pour la création) ou le cache se
met à jour automatiquement (pour la modification).

---

## Opérations et comportement du cache

| Opération | Document GraphQL | Cache après la mutation |
|---|---|---|
| Liste | `GetCategories(page, size)` | (lecture seule) |
| Créer | `CreateCategory(input)` | `refetchQueries: ['GetCategories']` -- re-fetche la page 0 |
| Modifier | `UpdateCategory(id, input)` | Automatique (Apollo met à jour par `id`) |
| Supprimer | `DeleteCategory(id)` | `cache.evict + cache.gc` |

**Pourquoi la création utilise-t-elle `refetchQueries` et pas `cache.modify` ?**  
Quand une nouvelle entité est créée, le nombre total change et la nouvelle entité peut
apparaître sur une page différente selon l'ordre de tri. Il est plus simple et plus sûr de
re-fetcher la page 0 que d'essayer d'insérer le nouvel élément à la bonne position dans le
cache.

**Pourquoi la modification fonctionne-t-elle automatiquement ?**  
Apollo normalise chaque objet dans le cache par `__typename + id`. Quand une mutation
`UpdateCategory` retourne un fragment `CategoryFields` avec le même `id`, Apollo fusionne
les nouvelles valeurs de champs dans l'entrée en cache. Toute query qui incluait cette
catégorie retournera immédiatement la valeur mise à jour sans requête réseau supplémentaire.

---

## Règle métier : suppression bloquée

Supprimer une catégorie qui a encore des produits retourne une erreur `BAD_REQUEST` depuis
le backend. Le message d'erreur explique quelle contrainte a été violée (par ex.
"Impossible de supprimer une catégorie qui a des produits"). La page affiche ce message
verbatim dans une snackbar d'erreur -- ne le remplacez jamais par un message générique
"Échec de la suppression", car le message backend dit exactement à l'utilisateur quoi faire
(supprimer d'abord les produits).

---

## Le service CategoryOptions

`src/app/features/categories/data/category-options.ts` est un service séparé qui exécute
une query `GetCategories` simplifiée sans pagination (récupère toutes les catégories d'un
coup). Il est utilisé par la fonctionnalité **products** à deux fins :

1. Le menu déroulant de filtre par catégorie sur la page de liste des produits.
2. Le select de catégorie dans le dialog de création/modification des produits.

Le garder comme service séparé plutôt que comme méthode de `CategoriesService` évite une
dépendance circulaire : `products` importe depuis `categories`, mais `categories` ne devrait
jamais importer depuis `products`.

---

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/app/features/categories/data/categories.graphql` | Fragment CategoryFields, opérations CRUD |
| `src/app/features/categories/data/categories.ts` | Service de fonctionnalité Categories |
| `src/app/features/categories/data/category-options.ts` | Query partagée pour les selects de catégories |
| `src/app/features/categories/pages/category-list/` | Page de liste paginée |
| `src/app/features/categories/dialogs/category-form/` | Dialog de création/modification |
| `src/app/features/categories/categories.routes.ts` | Route lazy : `/categories` |
