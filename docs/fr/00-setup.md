# Installation et premier démarrage

Ce guide explique pas à pas comment cloner, installer et démarrer le projet depuis zéro.
Vous démarrerez d'abord le backend, puis le frontend, et vous vérifierez que les deux
communiquent correctement avant d'écrire la moindre ligne de code.

---

## Prérequis

Installez chaque outil de la liste ci-dessous avant de continuer. Les versions sont
importantes : Angular 21 nécessite Node 22.x et refusera de démarrer sur une version
plus ancienne.

| Outil | Version minimale | Comment vérifier |
|---|---|---|
| Node.js | 22.x (LTS) | `node -v` |
| npm | 10.x (fourni avec Node 22) | `npm -v` |
| Angular CLI | 21 | `ng version` |
| Docker Desktop | 4.x | `docker -v` |
| Docker Compose | 2.x (fourni avec Docker Desktop) | `docker compose version` |

Installer Angular CLI globalement si vous ne l'avez pas encore :

```bash
npm install -g @angular/cli@21
```

> **Pourquoi Docker ?** Le backend (`spring-graphql-tutorial`) est une application Spring
> Boot qui nécessite PostgreSQL et MailHog. Les lancer avec Docker Compose démarre les trois
> services (l'API, la base de données et le collecteur de mails) en une seule commande, sans
> installer Java ou PostgreSQL localement.

---

## Étape 1 -- Démarrer le backend

Le frontend consomme
[spring-graphql-tutorial](https://github.com/EdgarEldy/spring-graphql-tutorial), une API
Spring Boot / Spring for GraphQL qui expose un unique endpoint GraphQL sur `/graphql`.

```bash
git clone https://github.com/EdgarEldy/spring-graphql-tutorial.git
cd spring-graphql-tutorial
docker compose up
```

Docker Compose démarre trois conteneurs :

| Conteneur | Rôle | Port |
|---|---|---|
| `spring-graphql-api` | Application Spring Boot | 8080 |
| `spring-graphql-db` | Base de données PostgreSQL 16 | 5432 |
| `mailhog` | Collecteur SMTP avec interface web | 8025 |

**Vérifier que le backend est prêt.** Dès que vous voyez une ligne similaire à
`Started SpringGraphqlTutorialApplication in X seconds` dans les logs Docker, ouvrez votre
navigateur et allez sur `http://localhost:8080/graphiql`. L'IDE GraphiQL doit se charger.
Si c'est le cas, l'API est en cours d'exécution et prête à recevoir des requêtes.

> **Qu'est-ce que MailHog ?** Quand un utilisateur s'inscrit ou demande une
> réinitialisation de mot de passe, le backend envoie un email de confirmation.
> En développement, ces emails sont capturés par MailHog au lieu d'être réellement
> envoyés. Ouvrez `http://localhost:8025` pour les lire.

---

## Étape 2 -- Installer et démarrer le frontend

Ouvrez un **nouveau terminal** (laissez Docker tourner dans le premier), puis :

```bash
git clone https://github.com/EdgarEldy/angular-graphql-tutorial.git
cd angular-graphql-tutorial
npm install
npm start
```

`npm start` lance `ng serve` avec `proxy.conf.json`, qui redirige toutes les requêtes vers
`/graphql` depuis le navigateur vers `http://localhost:8080` sur votre machine. C'est ce
qui permet au frontend d'atteindre le backend sans se heurter aux restrictions CORS en
développement.

Vous devriez voir une sortie similaire à :

```
✔ Browser application bundle generation complete.
Watch mode enabled. Watching for file changes...
  ➜ Local: http://localhost:4200/
```

Ouvrez `http://localhost:4200` dans le navigateur. La page de connexion doit s'afficher.

---

## Étape 3 -- Créer un compte et se connecter

La base de données est vide au premier démarrage. Utilisez le formulaire d'inscription pour
créer un compte :

1. Accédez à `http://localhost:4200/auth/register`.
2. Remplissez le formulaire et soumettez-le.
3. Ouvrez MailHog sur `http://localhost:8025` et cliquez sur l'email d'activation.
4. Copiez le token d'activation depuis le lien dans l'email.
5. Accédez à `http://localhost:4200/auth/activate-account?token=<votre-token>`.
6. Le compte est maintenant actif. Connectez-vous sur `http://localhost:4200/auth/login`.

> **Rôle ADMIN.** Lors du premier démarrage, Flyway exécute les migrations de la base de
> données et crée un utilisateur ADMIN de démarrage (identifiants dans le README du
> backend). Connectez-vous avec ce compte pour accéder aux écrans d'administration Utilisateurs,
> Rôles et Permissions.

---

## Scripts NPM

| Script | Quand l'utiliser |
|---|---|
| `npm start` | Développement quotidien. Lance le serveur de dev sur le port 4200 avec le proxy. |
| `npm run build` | Avant de déployer. Produit un bundle optimisé dans `dist/`. |
| `npm test` | Après chaque modification. Lance la suite de tests unitaires Vitest. |
| `npm run lint` | Avant de commiter. Lance angular-eslint sur tous les fichiers TypeScript et templates. |
| `npm run codegen` | Après avoir modifié un fichier `*.graphql` ou mis à jour le schéma. |
| `npm run codegen:watch` | Quand on itère sur des documents GraphQL. Surveille et régénère à la sauvegarde. |
| `npm run schema:update` | Quand le schéma backend change. Télécharge le nouveau schéma et relance codegen. |

---

## Proxy de développement

`proxy.conf.json` à la racine du projet configure le serveur de dev Angular pour rediriger
toutes les requêtes dont le chemin commence par `/graphql` vers `http://localhost:8080`.
Cela couvre à la fois HTTP (requêtes et mutations en POST) et WebSocket (subscriptions).
Sans le proxy, le navigateur bloquerait les requêtes cross-origin vers le port 8080.

Le proxy est enregistré dans `angular.json` sous
`projects.<name>.architect.serve.options` :

```json
"proxyConfig": "proxy.conf.json"
```

En production (le build Docker), c'est nginx qui joue le même rôle de proxy.

---

## Lancer avec Docker (optionnel)

Si vous souhaitez faire tourner le **frontend** dans un conteneur plutôt qu'avec `npm start` :

```bash
docker compose up
```

Le `Dockerfile` à la racine du projet est un build en deux étapes :

1. **Étape de build** : installe les dépendances et lance `npm run build`.
2. **Étape de service** : copie le résultat de `dist/` dans une image nginx.

`nginx.conf` proxifie `/graphql` vers `host.docker.internal:8080` (le backend sur votre
machine) et sert l'application Angular en mode SPA avec le fallback HTML5 history pour que
le rechargement d'une URL profonde ne retourne pas 404.

> Le Docker Compose du frontend ne démarre pas le backend. Lancez le backend séparément
> depuis le dossier `spring-graphql-tutorial`.

---

## Résolution des problèmes courants

**`npm start` échoue avec `ECONNREFUSED` dans la console du navigateur.**  
Le frontend a démarré mais ne peut pas atteindre le backend. Vérifiez que les conteneurs
Docker du backend sont en cours d'exécution (`docker ps`) et que le port 8080 est libre.

**GraphiQL sur `http://localhost:8080/graphiql` ne se charge pas.**  
Le conteneur Spring Boot est peut-être encore en train de démarrer. Attendez 30 secondes
et rafraîchissez. Si le conteneur s'est arrêté, lancez
`docker compose logs spring-graphql-api` pour voir l'erreur.

**MailHog ne montre aucun email.**  
Vérifiez que le conteneur MailHog est en cours d'exécution (`docker ps`). Le backend envoie
les emails de façon asynchrone ; attendez quelques secondes après l'inscription.

**Erreurs TypeScript après avoir tiré des modifications.**  
Lancez `npm run codegen` pour régénérer `src/app/core/graphql/generated/graphql.ts` si
le schéma a changé dans le pull.
