# VBT Workflow Copilot (Bootstrap)

Thin-slice implementation of the Estimates workflow from `spec/ARCHITECTURE.md`.  
This phase focuses on Prisma-backed project data, Chakra UI, server actions, and a manual (non-LLM) six-stage estimate experience.

## Requirements

- Node.js ≥ 20
- npm (ships with Node)
- Docker Desktop (or any Docker engine with the Compose plugin)

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env`, then adjust any values:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL` already targets the Dockerized Postgres container.
   - Fill in `OPENAI_API_KEY` when you start wiring the Copilot; it can stay blank for now.

3. **Start the local Postgres container**

   ```bash
   npm run db:up
   ```

   - Stop it with `npm run db:down`.
   - Reset (destroy + recreate) with `npm run db:reset`.

4. **Generate the Prisma client**

   ```bash
   npx prisma generate
   ```

5. **Run the dev server**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000` to explore the dashboard and Estimates workflow (list + detail views).

## Estimates Workflow (Phase 1)

- **Estimates list (`/estimates`)**
  - Server-rendered list powered by `estimatesService.listProjects()`.
  - Client-side filters, search, empty-state messaging, and a `react-hook-form` + Zod create-project form tied to server actions with Chakra toasts.
- **Project detail (`/estimates/[projectId]`)**
  - Stage navigator highlighting the current step and surfacing entry criteria text for all six stages.
  - Stage-specific editors:
    - **Artifacts**: list with removal + add form (URL validation, notes).
    - **Business Case / Requirements / Solution**: narrative editors with “Save draft” and “Approve & advance” actions that persist content and push the workflow forward.
    - **Effort Estimate**: WBS table editor (add/remove rows, numeric validation, running totals) persisted through `updateWbsItemsAction`.
    - **Quote**: fields for payment terms, timeline, totals, and a “Mark delivered & advance” control.
  - Support components: transition timeline, artifact summary card, contextual alerts, and route-level loading states.
- **LLM/Copilot** integrations are intentionally deferred; every action is manual so the workflow can be validated end-to-end before adding AI assistance.

## Project Structure

- `app/`
  - `page.tsx`: dashboard skeleton
  - `estimates/`, `contracts/`: placeholder routes for both workflows
  - `api/health/db`: GET endpoint that runs `SELECT 1` via Prisma as a connectivity check
- `lib/`
  - `theme.ts`, `db.ts`, placeholder service/zod/copilot utilities
- `prisma/`
  - `schema.prisma`: starter models for the Estimates workflow (will evolve)
- `docker-compose.yml`
  - Defines the single Postgres 16 container (`vbt-postgres`) with a persistent named volume
- `requirements/`, `spec/`
  - Source PDF and planning artifacts (do not modify)

## Next Steps

- Flesh out Prisma models for projects, stages, agreements, etc.
- Implement server actions + services per the architecture spec.
- Wire the Copilot action registry to real mutations.
- Capture AI prompt engineering details in `AI_ARTIFACTS.md` as the workflows evolve.

## Testing

Vitest covers the most critical service logic (ordered stage transitions + WBS CRUD) via a lightweight Prisma mock in `tests/estimatesService.test.ts`.

```bash
npm run test
```

## Database Health Check

Ensure the app can reach Postgres:

```bash
curl http://localhost:3000/api/health/db
```

It returns `{ "status": "ok" }` when the Prisma client (from `lib/db`) successfully runs `SELECT 1`.
