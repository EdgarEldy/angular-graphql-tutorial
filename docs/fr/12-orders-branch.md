# Branche : feature/orders

La dernière branche de fonctionnalité. S'appuie sur `feature/customers`. Introduit les
subscriptions GraphQL (mises à jour en temps réel), les tableaux de formulaire dynamiques
(articles de commande), et la distinction entre le total côté client (aperçu) et le total
faisant autorité côté serveur.

---

## Ce que vous allez apprendre

- Comment implémenter une subscription GraphQL avec `graphql-ws` et `takeUntilDestroyed()`
- Comment dédupliquer les événements de subscription (éviter de compter ses propres
  commandes nouvellement créées)
- Comment gérer les articles de commande comme un tableau de formulaire dynamique (ajouter/
  supprimer des lignes à l'exécution)
- Pourquoi le total côté client n'est qu'un aperçu et lequel afficher dans quel contexte
- Comment coloriser un chip de statut avec Angular Material et des classes CSS

---

## Écrans

### Liste des commandes (`/orders`)

Tableau paginé avec colonnes : numéro de commande, nom du client, chip de statut, date de
création, total.

Un badge en direct au-dessus du tableau compte les commandes arrivées via subscription
depuis le dernier chargement de page. Cliquer sur le badge appelle `refetch()` sur la query
de liste et remet le compteur à zéro.

Actions admin : "Nouvelle commande" dans l'en-tête de page, "Modifier" et "Supprimer" par
ligne. Cliquer sur une ligne navigue vers `/orders/:id`.

### Détail d'une commande (`/orders/:id`)

Vue en lecture seule avec deux sections :

1. **Fiche commande** -- numéro de commande, chip de statut, date de création, nom et email
   du client.
2. **Tableau des articles** -- nom du produit, quantité, prix unitaire, total de la ligne
   (quantité × prix unitaire). En dessous du tableau : "Total général" issu de `order.total`
   (calculé par le serveur).

> Le total général affiché dans la vue de détail vient du champ `total` dans la réponse
> GraphQL, que le backend calcule. Ne le calculez jamais côté client pour l'affichage dans
> la vue de détail ; utilisez la valeur serveur.

### Dialog de création/modification (`OrderFormDialog`)

Champs :

- `customerId` (requis, `mat-select` peuplé depuis une liste de clients)
- `status` (requis, `mat-select` avec les valeurs de l'enum `OrderStatus`)
- **Articles de commande** (liste dynamique) : chaque ligne a `productId` (requis,
  `mat-select`) et `quantity` (requis, entier >= 1). Le prix unitaire est en lecture seule,
  récupéré quand le produit est sélectionné et affiché comme référence.

Boutons de la section articles : **Ajouter un article** (ajoute une nouvelle ligne) et
**Supprimer** par ligne.

Un aperçu du total côté client est calculé pendant que l'utilisateur construit la commande :
```
Total estimé = somme de (quantité × prixUnitaire) pour tous les articles
```

Cet aperçu est clairement libellé "Total estimé" et peut différer du total serveur (qui
peut appliquer des remises, des taxes ou des règles d'arrondi). Il est là pour donner à
l'utilisateur une idée approximative avant la sauvegarde.

---

## La subscription `orderCreated`

La subscription `orderCreated` reçoit une notification à chaque fois qu'un utilisateur crée
une nouvelle commande. La page de liste des commandes s'abonne pendant qu'elle est active
et se désabonne quand l'utilisateur navigue ailleurs.

```graphql
subscription OrderCreated {
  orderCreated { ...OrderFields }
}
```

**Comment elle est consommée :**

```typescript
ngOnInit(): void {
  this.ordersService.watchOrderCreated()
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(newOrder => {
      // Vérifier si cette commande est déjà dans le cache (l'utilisateur courant vient de la créer)
      if (!this.isAlreadyInCache(newOrder.id)) {
        this.newOrderCount.update(n => n + 1);
      }
    });
}
```

**Pourquoi ne pas mettre à jour la liste automatiquement à chaque événement ?**  
Injecter une nouvelle ligne au milieu d'un tableau paginé à chaque événement entrant ferait
sauter le tableau pendant que l'utilisateur est en train de le lire. À la place, le badge
compteur informe l'utilisateur que de nouvelles données sont disponibles, et il peut choisir
quand rafraîchir.

**Déduplication :**  
Quand l'utilisateur courant crée une commande, la réponse de la mutation l'a déjà ajoutée
au cache. La subscription `orderCreated` va aussi se déclencher pour la même commande peu
après. Sans déduplication, le badge s'incrémenterait même pour les propres commandes de
l'utilisateur. Le composant vérifie `cache.readFragment()` pour l'`id` entrant avant
d'incrémenter.

---

## Couleurs des chips de statut

Le statut d'une commande est un enum avec cinq valeurs. Chaque valeur se mappe sur un style
visuel :

| Statut | Couleur | Implémentation |
|---|---|---|
| `PENDING` | Ambre | `color="warn"` sur `mat-chip` |
| `CONFIRMED` | Bleu | `color="primary"` |
| `SHIPPED` | Bleu-vert | `color="accent"` |
| `DELIVERED` | Vert | Classe CSS personnalisée `.status-delivered` |
| `CANCELLED` | Gris | `color=""` (par défaut) |

Angular Material n'a pas de couleur de thème "succès" (vert) intégrée, donc `DELIVERED`
utilise une classe personnalisée définie dans le SCSS du composant.

---

## Mises à jour du cache

| Opération | Stratégie de cache |
|---|---|
| Créer | `refetchQueries: ['GetOrders']` pour maintenir la pagination correcte |
| Modifier | Automatique (Apollo met à jour par `id`) |
| Supprimer | `cache.evict + cache.gc` |

---

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/app/features/orders/data/orders.graphql` | OrderFields, opérations CRUD, subscription `orderCreated` |
| `src/app/features/orders/data/orders.ts` | Service de fonctionnalité Orders |
| `src/app/features/orders/pages/order-list/` | Page de liste avec badge en direct |
| `src/app/features/orders/pages/order-detail/` | Page de détail avec tableau d'articles |
| `src/app/features/orders/dialogs/order-form/` | Dialog de création/modification avec articles dynamiques |
| `src/app/features/orders/orders.routes.ts` | Routes lazy : `/orders`, `/orders/:id` |
