# Environment & Database Setup Plan

### Goal

Provide a lightweight, reproducible local environment using Postgres in Docker, clean `.env` management, and simple scripts so the app can talk to a local database with minimal friction.

### Scope

- **In scope**: Dockerized Postgres, `DATABASE_URL` wiring, Prisma connection sanity check, and documentation/scripts to run everything locally.
- **Out of scope**: Defining Prisma models, running real migrations, or seeding domain data (those will come with the estimates/contracts slices).

### Steps

#### 1. Dockerized Postgres

1. Add a `docker-compose.yml` at the repo root defining a `postgres` service:

- Image: `postgres:16`.
- Container name: `vbt-postgres`.
- Expose port `5432` on the host.
- Set `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` (e.g. `vbt_hiring_test`).
- Use a named volume (e.g. `postgres_data`) for persistent storage.
- Optionally add a basic `healthcheck` so scripts can wait for readiness.

2. Ensure the compose file does **not** conflict with any other services; keep it focused on Postgres only for now.

#### 2. Environment Configuration

1. Configure `.env` for local development:

- Add `DATABASE_URL` pointing at the Dockerized Postgres instance (e.g. `postgresql://vbt:vbt@localhost:5432/vbt_hiring_test`).
- Keep any existing variables intact.

2. Create an `.env.example` file (no secrets) showing required keys:

- `DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DB_NAME"`.
- Placeholder for `OPENAI_API_KEY` and any other future keys.

3. Confirm that Next.js and Prisma both read from `.env` correctly (no custom env loading needed).

#### 3. Prisma & Database Sanity Check

1. Verify `prisma/schema.prisma` still contains only the datasource and generator blocks (no models yet, matching the bootstrap plan).
2. Run `npx prisma generate` to confirm the client builds successfully against the configured `DATABASE_URL`.
3. Optionally add a tiny Node script or Next.js route handler (e.g. `app/api/health/db/route.ts`) that:

- Imports `prisma` from `lib/db`.
- Executes a trivial query like `await prisma.$queryRaw` using `SELECT 1`.
- Returns a simple JSON response `{ status: "ok" }` if the connection works.
- This serves as a quick manual verification that the app can reach the database.

#### 4. NPM Scripts & Developer Experience

1. Add convenience scripts in `package.json`:

- `"db:up": "docker compose up -d postgres"`.
- `"db:down": "docker compose down"`.
- Optionally `"db:reset": "docker compose down -v && docker compose up -d postgres"` for a clean slate.

2. Ensure these scripts are mentioned in the docs so new developers can bring the DB up with one command.

#### 5. Documentation Updates

1. Update `README.md` with an "Environment & Database" section that covers:

- Prerequisites: Docker installed.
- Steps to start the DB: `npm run db:up`.
- Steps to stop/reset the DB.
- How to set `DATABASE_URL` in `.env` and where to find an example.

2. Optionally add a short note in `APPROACH.md` explaining that Postgres is Dockerized for reproducible local development and is intentionally minimal for the hiring test.

### Deliverable for This Phase

- A working Dockerized Postgres instance controllable via `npm run db:up` / `db:down`.
- `.env` / `.env.example` configured with `DATABASE_URL` and ready for future secrets.
- Prisma successfully generating a client against the Docker DB.
- Clear documentation showing how to bring up the database and verify connectivity (via script or health endpoint).