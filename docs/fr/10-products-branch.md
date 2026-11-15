# Branche : feature/products

S'appuie sur `feature/categories`. Introduit les queries multi-filtres et réutilise le
service `CategoryOptions` de la branche précédente.

---

## Ce que vous allez apprendre

- Comment passer plusieurs filtres optionnels à une query GraphQL
- Comment gérer différents types de saisie (recherche textuelle, plage de nombres, select)
- Comment omettre les variables `null` ou `undefined` pour que le backend les ignore
- Comment réutiliser une query d'une autre fonctionnalité (`CategoryOptions`)
- Comment `ProductFields` embarque un fragment `CategoryFields` imbriqué pour éviter une
  requête supplémentaire

---

## Écrans

### Liste des produits (`/products`)

Un tableau paginé avec quatre colonnes : nom du produit, catégorie, prix unitaire
(formaté avec le pipe currency), et boutons d'action admin.

Au-dessus du tableau, une barre de filtres avec quatre contrôles indépendants :

| Contrôle | Variable | Déclencheur | Remet à zéro la page ? |
|---|---|---|---|
| Select de catégorie | `categoryId` | Au changement de sélection | Oui |
| Nom du produit | `productName` | À chaque frappe (événement `input`) | Oui |
| Prix minimum | `minPrice` | Sur blur (événement `change`) | Non |
| Prix maximum | `maxPrice` | Sur blur (événement `change`) | Non |

**Pourquoi le nom est-il filtré à chaque frappe mais le prix sur blur ?**  
Taper un nom caractère par caractère produit des résultats intermédiaires raisonnables
("Bo" -> "Boissons fraiches", "Boi" -> "Boisson gazeuse"). Taper un prix caractère par
caractère ne le fait pas : "$" ou "$1" avec un prix max de "$100" produit des résultats
parasites. Déclencher le filtre prix sur blur (quand l'utilisateur quitte le champ) envoie
une seule requête propre par valeur saisie.

**Omission des filtres vides :**  
Quand un contrôle de filtre est vide ou null, la variable est entièrement omise de l'objet
des variables de la query. Le backend interprète une variable absente comme "pas de filtre
sur ce champ" :

```typescript
// Dans le service :
variables: {
  page, size,
  ...(categoryId ? { categoryId } : {}),
  ...(productName ? { productName } : {}),
  ...(minPrice !== null ? { minPrice } : {}),
  ...(maxPrice !== null ? { maxPrice } : {}),
}
```

### Dialog de création/modification (`ProductFormDialog`)

Champs : `productName` (requis), `unitPrice` (requis, doit être > 0), `categoryId` (requis,
`mat-select` peuplé depuis `CategoryOptions`).

`unitPrice` est un `Float` en GraphQL. Le contrôle de formulaire contient un `number`.
Le champ accepte des valeurs décimales. La valeur est affichée avec
`{{ product.unitPrice | currency }}` dans le tableau.

---

## Fragment imbriqué : CategoryFields dans ProductFields

`ProductFields` inclut la catégorie comme sélection imbriquée :

```graphql
fragment ProductFields on Product {
  id
  productName
  unitPrice
  category { ...CategoryFields }  # fragment imbriqué
}
```

Cela signifie que la query de liste des produits retourne à la fois les données du produit
et le nom complet de la catégorie en une seule requête. Aucune deuxième query n'est
nécessaire pour afficher le nom de la catégorie sur chaque ligne.

Apollo normalise la catégorie par son propre `id`. Si la même catégorie apparaît à la fois
dans la liste des produits et dans la liste des catégories, elles partagent la même entrée
en cache et les mises à jour du nom de la catégorie se propagent dans les deux vues.

---

## Mises à jour du cache

Même stratégie que pour les catégories :

| Opération | Stratégie de cache |
|---|---|
| Créer | `refetchQueries: ['GetProducts']` |
| Modifier | Automatique (Apollo met à jour par `id`) |
| Supprimer | `cache.evict + cache.gc` |

---

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/app/features/products/data/products.graphql` | Fragment ProductFields, opérations CRUD |
| `src/app/features/products/data/products.ts` | Service de fonctionnalité Products |
| `src/app/features/products/pages/product-list/` | Page de liste paginée avec barre de filtres |
| `src/app/features/products/dialogs/product-form/` | Dialog de création/modification |
| `src/app/features/products/products.routes.ts` | Route lazy : `/products` |
