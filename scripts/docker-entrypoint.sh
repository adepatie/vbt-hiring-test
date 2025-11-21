#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '[docker-entrypoint] %s\n' "$*"
}

if [[ -z "${DATABASE_URL:-}" ]]; then
  log "DATABASE_URL must be set"
  exit 1
fi

log "Waiting for Postgres to accept connections..."
until pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; do
  sleep 2
done

log "Applying Prisma migrations..."
npx prisma migrate deploy

log "Seeding baseline data..."
npm run seed

if [[ "${RUN_DEMO_SEED:-false}" == "true" ]]; then
  log "RUN_DEMO_SEED is true; loading demo dataset..."
  npm run seed:demo
fi

log "Starting Next.js server..."
exec "$@"

