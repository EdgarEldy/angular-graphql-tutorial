# Branche : feature/auth

Cette branche s'appuie sur `feature/core-architecture` et ajoute la couche complète
d'authentification et de contrôle d'accès (RBAC) : écrans d'authentification publics,
gestion de session JWT, guards de route, directives de template, les écrans
d'administration utilisateurs/rôles/permissions, et la page de profil.

---

## Ce que vous allez apprendre

- Comment implémenter un flux de connexion/inscription avec des tokens JWT
- Comment persister une session entre les rechargements de page avec `localStorage` et les
  signals Angular
- Comment protéger les routes avec des guards (`authGuard`, `adminGuard`)
- Comment afficher et masquer des éléments UI selon les rôles avec une directive structurelle
- Comment construire un écran CRUD complet avec assignation de rôles et de permissions
- Comment mettre à jour le cache Apollo après avoir assigné des rôles ou des permissions

---

## Écrans d'authentification publics

Ces routes sont accessibles sans être connecté.

| Route | Mutation | Ce qui se passe |
|---|---|---|
| `/auth/login` | `login` | Soumet email + mot de passe ; en cas de succès stocke les tokens et navigue vers l'URL de retour ou `/dashboard` |
| `/auth/register` | `register` | Soumet prénom, nom, email, mot de passe, confirmer ; en cas de succès affiche "vérifiez votre email" |
| `/auth/activate-account?token=` | `activateAccount` | Lit le token depuis la query string ; active le compte ; affiche succès ou erreur |
| `/auth/forgot-password` | `requestPasswordReset` | Soumet email ; affiche toujours la même confirmation neutre |
| `/auth/reset-password?token=` | `resetPassword` | Soumet nouveau mot de passe + confirmation ; token depuis la query string |

**Le flux d'activation en détail :**

1. Après l'inscription, le backend envoie un email avec un lien comme
   `http://localhost:4200/auth/activate-account?token=abc123`.
2. MailHog capture l'email sur `http://localhost:8025`.
3. Cliquez sur le lien (ou collez l'URL dans le navigateur). La `ActivateAccountPage` lit
   le paramètre de query `token` et appelle la mutation `activateAccount` automatiquement
   au chargement.
4. En cas de succès, elle affiche "Votre compte est actif, veuillez vous connecter" avec un
   lien vers la page de connexion.

**Erreur en ligne à la connexion :**  
Un 401 de `POST /graphql` pour une mutation `login` signifie de mauvais identifiants.
L'erreur est affichée en ligne sur le champ email/mot de passe, pas comme une redirection
vers la page de connexion (qui est le comportement standard des 401 partout ailleurs).

---

## Gestion de session après la connexion

Quand `login` réussit, `AuthService.login()` :

1. Stocke l'`accessToken` et le `refreshToken` dans `localStorage`.
2. Décode le payload JWT (`auth.ts`) pour extraire l'id, l'email, les rôles et les
   permissions de l'utilisateur.
3. Met à jour le signal `_session` avec le payload décodé.
4. Les signals calculés (`isAuthenticated`, `isAdmin`, `roles`, `permissions`) se mettent
   à jour automatiquement car ils lisent `_session`.
5. La section Administration de la sidebar apparaît immédiatement car elle lit `isAdmin()`.

---

## Écrans admin (rôle ADMIN requis)

### Utilisateurs (`/users`)

Tableau paginé avec colonnes : nom complet, email, statut activé, statut verrouillé, rôles
(chips).

Actions admin par ligne :

- **Modifier** (`UserFormDialog`) : met à jour `firstName`, `lastName`, `email`.
- **Verrouiller / Déverrouiller** : appelle `lockUser` ou `unlockUser`. Désactivé pour
  la ligne de l'utilisateur courant (vous ne pouvez pas vous verrouiller vous-même).
- **Supprimer** : ouvre `ConfirmDialog`. Désactivé pour la ligne de l'utilisateur courant.
- **Gérer les rôles** (`ManageRolesDialog`) : affiche les rôles de l'utilisateur comme chips
  supprimables et un select "ajouter un rôle". Chaque changement appelle
  `updateUserRoles({ add: [id] })` ou `updateUserRoles({ remove: [id] })`. Après la
  mutation, `cache.writeFragment` met à jour le `UserFragment` en cache pour que la liste
  des chips se rafraîchisse sans re-fetcher toute la liste des utilisateurs.

### Rôles (`/roles`)

Tableau avec colonnes : nom du rôle, permissions (chips).

Actions admin :

- **Créer / Modifier** (`RoleFormDialog`) : un champ, `roleName`.
- **Supprimer** : ouvre `ConfirmDialog`.
- **Gérer les permissions** (`ManagePermissionsDialog`) : même pattern chip + select que les
  rôles. Utilise `updateRolePermissions({ add: [...], remove: [...] })`.

### Permissions (`/permissions`)

Tableau simple avec colonnes : `resource`, `action`. Route : `/permissions` (niveau racine,
pas un enfant de `/roles`).

Actions admin :

- **Créer** (`PermissionFormDialog`) : champs `resource` + `action`.
- **Supprimer** : ouvre `ConfirmDialog`.

Une permission créée ici apparaît dans le select "ajouter une permission" de chaque
`ManagePermissionsDialog`.

---

## Page de profil (`/profile`)

Accessible à tout utilisateur authentifié.

Affiche : nom complet, email, statut du compte (actif/en attente, verrouillé), rôles.

Le bouton **Modifier le profil** ouvre `UpdateProfileDialog`, qui appelle `updateProfile`.
En cas de succès, `AuthService.updateSessionUser()` fusionne les données retournées dans le
signal de session sans re-fetcher depuis le serveur, ce qui met à jour l'avatar et le nom
dans la barre d'outils instantanément.

---

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/app/core/auth/auth.ts` | Persistance du token (localStorage + signals) |
| `src/app/core/auth/auth.service.ts` | Gestion de session (login, logout, restoreSession) |
| `src/app/core/auth/auth.guard.ts` | Requiert une session valide |
| `src/app/core/auth/admin-guard.ts` | Requiert le rôle ADMIN |
| `src/app/features/auth/data/auth.graphql` | Login, register, me, refreshToken, updateProfile |
| `src/app/features/auth/data/auth-feature.ts` | register, activate, resetPassword, updateProfile |
| `src/app/features/users/data/users.graphql` | UserFragment, CRUD et assignation de rôles |
| `src/app/features/users/data/users.ts` | Service de fonctionnalité Users |
| `src/app/features/roles/data/roles.graphql` | RoleFragment, PermissionFragment, CRUD |
| `src/app/features/roles/data/roles.ts` | Service de fonctionnalité Roles |
