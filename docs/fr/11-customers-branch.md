# Branche : feature/customers

S'appuie sur `feature/products`. Introduit la navigation à deux niveaux (liste -> détail)
et une sous-liste paginée imbriquée (les commandes d'un client à l'intérieur de la page de
détail).

---

## Ce que vous allez apprendre

- Comment construire une navigation maître/détail avec deux routes (`/customers` et
  `/customers/:id`)
- Comment récupérer une collection paginée imbriquée dans une query de détail
- Comment gérer deux paires indépendantes de signaux page/size sur le même écran
- Comment l'erreur `BUSINESS_RULE` lors d'une suppression diffère d'une erreur système

---

## Écrans

### Liste des clients (`/customers`)

Tableau paginé avec colonnes : nom complet, email, téléphone. Un champ de recherche par nom
au-dessus du tableau filtre par `customerName` (se déclenche à chaque frappe, remet à zéro
la page 0).

Actions admin : "Nouveau client" dans l'en-tête de page, "Modifier" et "Supprimer" par
ligne.

Cliquer sur le nom d'une ligne navigue vers `/customers/:id`.

### Détail d'un client (`/customers/:id`)

Une vue en lecture seule avec deux sections :

1. **Fiche client** -- nom complet, email, téléphone, adresse, statut du compte.
2. **Sous-tableau de commandes** -- un `MatTable` paginé des commandes de ce client, avec
   colonnes : numéro de commande, chip de statut, date, total. Ce sous-tableau a ses propres
   signaux de page et de taille indépendants ; naviguer dans ses pages n'affecte pas la liste
   principale des clients.

La query de détail récupère à la fois les données du client et la première page de ses
commandes en une seule requête :

```graphql
query GetCustomer($id: ID!, $page: Int, $size: Int) {
  customer(id: $id) {
    ...CustomerFields
    orders(page: $page, size: $size) {
      content { ...OrderSummaryFields }
      totalElements
      totalPages
    }
  }
}
```

Quand l'utilisateur navigue dans le sous-tableau, le composant appelle `fetchMore()` sur la
query existante et Apollo fusionne le résultat dans le cache.

### Dialog de création/modification (`CustomerFormDialog`)

Champs : `firstName` (requis), `lastName` (requis), `email` (requis, validateur email),
`phone` (optionnel), `address` (optionnel).

---

## Deux états de pagination indépendants

La page de détail gère deux ensembles séparés de signaux de pagination :

```typescript
// Pour la liste extérieure des clients (préservée dans les query params URL)
customerPage = signal(0);
customerSize = signal(10);

// Pour le sous-tableau des commandes (local à la page de détail)
ordersPage = signal(0);
ordersSize = signal(5);
```

Changer `ordersPage` déclenche un `fetchMore` sur la query client -- elle re-exécute la
query avec la nouvelle variable `page` et Apollo fusionne le résultat dans l'entrée client
existante.

---

## Règle métier : suppression bloquée

Tenter de supprimer un client qui a des commandes retourne une erreur `BUSINESS_RULE`
(`422 Unprocessable Entity`) du backend. Le message est quelque chose comme :
"Le client ne peut pas être supprimé car il a des commandes existantes."

L'UI affiche ce message verbatim dans une snackbar d'erreur et la ligne reste dans le
tableau. L'utilisateur doit d'abord supprimer ou réassigner les commandes avant de
supprimer le client.

C'est différent d'une erreur `SERVER` (qui signifie que quelque chose s'est mal passé de
façon inattendue) : une erreur `BUSINESS_RULE` est une contrainte délibérée que le backend
applique, et le message est significatif pour l'utilisateur.

---

## Mises à jour du cache

| Opération | Stratégie de cache |
|---|---|
| Créer | `refetchQueries: ['GetCustomers']` |
| Modifier | Automatique (Apollo met à jour par `id`) |
| Supprimer | `cache.evict + cache.gc` |

---

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/app/features/customers/data/customers.graphql` | CustomerFields, OrderSummaryFields, CRUD |
| `src/app/features/customers/data/customers.ts` | Service de fonctionnalité Customers |
| `src/app/features/customers/pages/customer-list/` | Page de liste paginée avec filtre par nom |
| `src/app/features/customers/pages/customer-detail/` | Page de détail avec sous-tableau de commandes |
| `src/app/features/customers/dialogs/customer-form/` | Dialog de création/modification |
| `src/app/features/customers/customers.routes.ts` | Routes lazy : `/customers`, `/customers/:id` |
