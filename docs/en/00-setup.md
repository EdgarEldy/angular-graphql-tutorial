# Installation and first run

This guide walks you through cloning, installing, and running the project from scratch.
You will start the backend first, then the frontend, and verify that the two communicate
correctly before writing any code.

---

## Prerequisites

Install each tool listed below before continuing. The versions matter: Angular 21 requires
Node 22.x and will refuse to start on older runtimes.

| Tool | Minimum version | How to verify |
|---|---|---|
| Node.js | 22.x (LTS) | `node -v` |
| npm | 10.x (bundled with Node 22) | `npm -v` |
| Angular CLI | 21 | `ng version` |
| Docker Desktop | 4.x | `docker -v` |
| Docker Compose | 2.x (bundled with Docker Desktop) | `docker compose version` |

Install Angular CLI globally if you do not have it yet:

```bash
npm install -g @angular/cli@21
```

> **Why Docker?** The backend (`spring-graphql-tutorial`) is a Spring Boot application that
> requires PostgreSQL and MailHog. Running it with Docker Compose starts all three services
> (the API, the database, and the mail catcher) in one command without installing Java or
> PostgreSQL locally.

---

## Step 1 -- Start the backend

The frontend consumes
[spring-graphql-tutorial](https://github.com/EdgarEldy/spring-graphql-tutorial), a Spring
Boot / Spring for GraphQL API that exposes a single GraphQL endpoint at `/graphql`.

```bash
git clone https://github.com/EdgarEldy/spring-graphql-tutorial.git
cd spring-graphql-tutorial
docker compose up
```

Docker Compose starts three containers:

| Container | What it does | Port |
|---|---|---|
| `spring-graphql-api` | Spring Boot application | 8080 |
| `spring-graphql-db` | PostgreSQL 16 database | 5432 |
| `mailhog` | SMTP mail catcher with a web UI | 8025 |

**Verify the backend is ready.** Once you see a line similar to
`Started SpringGraphqlTutorialApplication in X seconds` in the Docker logs, open your
browser and navigate to `http://localhost:8080/graphiql`. The GraphiQL IDE should load.
If it does, the API is running and accepting requests.

> **What is MailHog?** When a user registers or requests a password reset, the backend sends
> a confirmation email. In development, those emails are captured by MailHog instead of being
> delivered. Open `http://localhost:8025` to read them.

---

## Step 2 -- Install and run the frontend

Open a **new terminal** (keep Docker running in the first one), then:

```bash
git clone https://github.com/EdgarEldy/angular-graphql-tutorial.git
cd angular-graphql-tutorial
npm install
npm start
```

`npm start` runs `ng serve` with `proxy.conf.json`, which forwards every request to
`/graphql` from the browser to `http://localhost:8080` on your machine. This is how the
frontend reaches the backend without hitting CORS restrictions during development.

You should see output like:

```
✔ Browser application bundle generation complete.
Watch mode enabled. Watching for file changes...
  ➜ Local: http://localhost:4200/
```

Open `http://localhost:4200` in the browser. The login page should appear.

---

## Step 3 -- Create an account and log in

The database is empty on first run. Use the registration form to create an account:

1. Navigate to `http://localhost:4200/auth/register`.
2. Fill in the form and submit.
3. Open MailHog at `http://localhost:8025` and click the activation email.
4. Copy the activation token from the link in the email.
5. Navigate to `http://localhost:4200/auth/activate-account?token=<your-token>`.
6. The account is now active. Log in at `http://localhost:4200/auth/login`.

> **Admin role.** The first time Flyway runs the database migrations, it seeds one ADMIN user
> (credentials are in the backend README). Log in with that account to access the Users,
> Roles, and Permissions administration screens.

---

## NPM scripts

| Script | When to use |
|---|---|
| `npm start` | Daily development. Starts the dev server on port 4200 with the proxy. |
| `npm run build` | Before deploying. Produces an optimised bundle in `dist/`. |
| `npm test` | After every change. Runs the Vitest unit test suite via `ng test`. |
| `npm run lint` | Before committing. Runs angular-eslint on all TypeScript and template files. |
| `npm run codegen` | After changing any `*.graphql` file or pulling a schema update. |
| `npm run codegen:watch` | When iterating on GraphQL documents. Watches and regenerates on save. |
| `npm run schema:update` | When the backend schema changes. Downloads the latest schema and runs codegen. |

---

## Dev proxy

`proxy.conf.json` at the project root configures Angular's dev server to proxy all requests
whose path starts with `/graphql` to `http://localhost:8080`. This covers both HTTP (queries
and mutations sent as POST) and WebSocket (subscriptions). Without the proxy, the browser
would block cross-origin requests to port 8080.

The proxy is registered in `angular.json` under `projects.<name>.architect.serve.options`:

```json
"proxyConfig": "proxy.conf.json"
```

In production (the Docker build), nginx handles the same proxying role.

---

## Running with Docker (optional)

If you want to run the **frontend** in a container instead of with `npm start`:

```bash
docker compose up
```

The `Dockerfile` at the project root is a two-stage build:

1. **Build stage**: installs dependencies and runs `npm run build`.
2. **Serve stage**: copies the `dist/` output into an nginx image.

`nginx.conf` proxies `/graphql` to `host.docker.internal:8080` (the backend running on your
machine) and serves the Angular SPA with HTML5 history fallback so that reloading a deep URL
does not return 404.

> The frontend Docker Compose file does not start the backend. Run the backend separately
> with `docker compose up` from the `spring-graphql-tutorial` directory.

---

## Troubleshooting

**`npm start` fails with `ECONNREFUSED` in the browser console.**
The frontend started but cannot reach the backend. Check that the backend Docker containers
are running (`docker ps`) and that port 8080 is free.

**GraphiQL at `http://localhost:8080/graphiql` does not load.**
The Spring Boot container may still be starting. Wait 30 seconds and refresh. If the
container exited, run `docker compose logs spring-graphql-api` to see the error.

**MailHog shows no emails.**
Make sure the MailHog container is running (`docker ps`). The backend sends emails
asynchronously; wait a few seconds after registering before checking.

**`npm run codegen` fails with a network error.**
Codegen reads `schema/schema.graphqls` from disk, not from a live server. The file is
already committed. Run `npm run codegen` again -- if it still fails, check that Node 22 is
active (`node -v`).

**TypeScript errors after pulling changes.**
Run `npm run codegen` to regenerate `src/app/core/graphql/generated/graphql.ts` in case the
schema changed in the pull.
