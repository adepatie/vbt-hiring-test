# VBT Workflow Copilot

Thin-slice implementation of the Estimates + Contracts workflows from `spec/ARCHITECTURE.md`.  
The current iteration runs on shadcn UI + Tailwind, stores workflow state in Prisma (including shared `QuoteSettings`), and drives every stage via a Model Context Protocol (MCP) Copilot stack.

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

   - `DATABASE_URL` should point at the Compose host (`postgres`). If you run `npm run dev` directly on your machine, temporarily swap the host to `localhost` so the app can reach the forwarded port.
   - Fill in `OPENAI_API_KEY` so the MCP LLM server (`lib/mcp/server.ts`) can talk to your provider; the rest of the app only speaks to the MCP layer.
   - Set `RUN_DEMO_SEED=true` only when you want the optional Apollo agreements dataset loaded automatically after the baseline seed.
   - Optional knobs for Copilot tuning:
     - `LLM_TIMEOUT_MS` (default `90000`) and `LLM_MAX_OUTPUT_TOKENS` (default `1200`) shape the upstream call.
     - `COPILOT_ARTIFACT_CONTEXT_TOKEN_LIMIT` (default `2600`) caps how much raw artifact text flows into prompts.
     - Requirements budgets: `LLM_REQUIREMENTS_MAX_OUTPUT_TOKENS` (default `1800`) and `LLM_REQUIREMENTS_BUSINESS_CASE_MAX_CHARS` (default `6000`).
     - Solution budgets: `LLM_SOLUTION_MAX_OUTPUT_TOKENS` (default `4000`), `LLM_SOLUTION_BUSINESS_CASE_MAX_CHARS` (default `6000`), and `LLM_SOLUTION_REQUIREMENTS_MAX_CHARS` (default `6000`).
     - Effort/WBS budgets: `LLM_EFFORT_MAX_OUTPUT_TOKENS` (default `1800`) and `LLM_WBS_MAX_ITEMS` (default `18`) govern Copilot's Work Breakdown Structure output.
     - Quote budgets: `LLM_QUOTE_TERMS_MAX_OUTPUT_TOKENS` (default `1200`) controls payment terms and timeline generation.
     - `DEFAULT_OVERHEAD_FEE` (default `0`) sets the default overhead fee for new quotes.
     - `ENABLE_LLM_LOGGING=true` enables detailed prompt/response metrics inside the MCP server logs.

   ### Environment variables

   | Variable | Required | Purpose / Default |
   | --- | --- | --- |
   | `DATABASE_URL` | yes | Prisma + seeds connection string. Use host `postgres` inside Docker Compose; swap to `localhost` for host-only workflows. |
   | `OPENAI_API_KEY` / `LLM_API_KEY` | yes | Credentials for the MCP server. Only one is required; `OPENAI_API_KEY` wins if both are set. |
   | `OPENAI_MODEL` / `LLM_MODEL` | no | Overrides the default `gpt-4o-mini` model identifier. |
   | `LLM_TIMEOUT_MS`, `LLM_MAX_OUTPUT_TOKENS`, `LLM_*` | no | Budget knobs per workflow stage (requirements/solution/effort/quote). |
   | `COPILOT_ARTIFACT_CONTEXT_TOKEN_LIMIT` | no | Caps how much artifact text flows into LLM prompts (default `2600`). |
   | `DEFAULT_OVERHEAD_FEE` | no | Decimal overhead fee (%) applied to new quotes (default `0`). |
   | `ENABLE_LLM_LOGGING` | no | Enables detailed prompt/response metrics in the MCP logs. |
   | `ENABLE_DEV_SEED_ENDPOINT` | no | Allows `/api/dev/seed` to run outside of local dev. |
   | `RUN_DEMO_SEED` | no | Seeds the optional Apollo agreements dataset immediately after the baseline seed inside Docker. |
   | `SEED_*`, `DATABASE_URL_*` | no | Override DSNs for integration tests or targeted seeding (`SEED_DB_TARGET`, `SEED_DATABASE_URL`, etc.). |

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

5. **Seed the database (optional)**

   ```bash
   npm run seed            # uses DATABASE_URL / default local DB
   npm run seed:test       # targets the Docker test DB via env/test.env
   npm run seed:prod       # forces SEED_DB_TARGET=prod (uses DATABASE_URL_PROD or DATABASE_URL)
   npm run seed:demo       # optional: loads the Apollo + agreements demo dataset
   ```

   Toggling rules:

   - `SEED_DB_TARGET=test` prefers `DATABASE_URL_TEST` (falls back to `DATABASE_URL`).
   - `SEED_DB_TARGET=prod` prefers `DATABASE_URL_PROD` (falls back to `DATABASE_URL`).
   - `SEED_DATABASE_URL` overrides everything and points the seed script at an explicit DSN.
   - Set `SEED_SIZE=large` to fan out extra “stress” projects for performance testing.
   - `npm run seed:demo` is intentionally separate so the heavy Project Apollo agreements stay opt-in; run it after any of the base seed commands (it connects via whatever `DATABASE_URL` is active).

6. **Run the dev server**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000` to explore the dashboard and Estimates workflow (list + detail views).

## Dev Seed Endpoint

- Enable it by running in a non-production environment (default) or set `ENABLE_DEV_SEED_ENDPOINT=true`.
- POST `/api/dev/seed` to create a “Retail Performance Console (RPC)” project and automatically upload the four markdown discovery artifacts from `requirements/samples/`.
- Optional JSON body fields:
  - `projectName` / `clientName` to rename the seeded project.
  - `overwriteExisting` to reuse an existing project with the same name (will wipe artifacts + stages first).
  - `returnDetails` (default `true`) to include the hydrated project payload in the response.
- Example:

  ```bash
  curl -X POST http://localhost:3000/api/dev/seed \
    -H "Content-Type: application/json" \
    -d '{"overwriteExisting":true}'
  ```

The response lists the `projectId`, seeded artifact IDs, and (optionally) the full project record so you can open it in the browser and immediately run the Business Case Copilot action.

## Estimates Workflow (Phase 1)

- **Estimates list (`/estimates`)**
  - Server-rendered list powered by `estimatesService.listProjects()`.
  - Client-side filters, search, empty-state messaging, and a `react-hook-form` + Zod create-project form tied to server actions with shadcn components and Sonner toasts.
- **Project detail (`/estimates/[projectId]`)**
  - Stage navigator highlighting the current step and surfacing entry criteria text for all six stages.
  - Stage-specific editors:
    - **Artifacts**: list with removal + add form (URL validation, notes).
    - **Business Case / Requirements / Solution**: narrative editors with “Save draft,” “Approve & advance,” and Copilot regeneration controls tied to the MCP actions that auto-run when advancing stages.
    - **Effort Estimate**: WBS table editor (add/remove rows, numeric validation, running totals) that now offers a "Regenerate with Copilot" button and automatically runs after the Solution stage using the MCP `generate_wbs_items` tool. Rows are backed by the shared `Role` catalog ($/hour rate + label) so manual edits use a dropdown rather than free text, ensuring Copilot-generated WBS items and human edits stay in sync.
    - **Quote**: auto-calculated pricing breakdown (per-role totals, subtotal, overhead fee, total), payment terms and timeline fields (with "Regenerate with Copilot" button), CSV export and copy-to-clipboard buttons, and a "Mark delivered" control. The overhead fee can be managed via MCP tools (`quote.getPricingDefaults`, `quote.updatePricingDefaults`). Once marked as delivered, the quote is locked and the workflow is complete (the QUOTE stage is terminal).
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
  - `schema.prisma`: core workflow models plus `QuoteSettings`, the singleton table that stores pricing defaults used by new quotes.
- `docker-compose.yml`
  - Defines the single Postgres 16 container (`vbt-postgres`) with a persistent named volume
- `requirements/`, `spec/`
  - Source PDF and planning artifacts (do not modify)

## Next Steps

- Flesh out Prisma models for projects, stages, agreements, etc.
- Implement server actions + services per the architecture spec.
- Wire the Copilot action registry to real mutations.
- Capture AI prompt engineering details in `AI_ARTIFACTS.md` as the workflows evolve.

## MCP-based LLM architecture

- **Server**: `lib/mcp/server.ts` hosts a Model Context Protocol server with tools for `llm.chat`, `estimates.generateBusinessCaseFromArtifacts`, `estimates.generateRequirementsSummary`, `estimates.generateSolutionArchitecture`, `estimates.generateWbsItems`, and `estimates.summarizeArtifact`. It owns all OpenAI configuration (`OPENAI_*`, `LLM_*` env vars) and invokes the provider via `lib/mcp/providerClient.ts`.
- **Role tooling**: the MCP server also exposes `roles.list`, `roles.create`, and `roles.update` so Copilot (or other MCP clients) can manage the shared Role catalog that feeds the WBS stage and future quote calculations.
- **Client**: `lib/mcp/client.ts` is an in-process MCP client that the application layer calls (`mcpGenerateBusinessCaseFromArtifacts`, `mcpSummarizeArtifact`, `mcpChat`). It translates MCP errors into `CopilotLLMError` so existing error paths continue to work.
- **Application usage**: Higher-level helpers (`lib/copilot/actions.ts`, `lib/server/artifact-summary.ts`, etc.) now call the MCP client instead of hitting OpenAI directly. Business case drafts and artifact summaries are therefore generated without exposing raw files outside the server.
- **Extensibility**: To add a new LLM-powered workflow, create a new MCP tool in `lib/mcp/server.ts`, expose a typed helper in `lib/mcp/client.ts`, and call it from the relevant feature. This keeps provider details isolated from application logic.

### Copilot Chat & MCP Tool Orchestration

The Copilot chat endpoint (`copilotActions["chat.run"]`) uses the MCP chat bridge (`llm.chat`) plus a registry of domain tools to decide when to call MCP tools and when to answer directly.

- **Tool registry**: `lib/mcp/registry.ts` defines `MCP_TOOLS` (e.g. `estimates.generateWbsItems`, `roles.list`, `quote.updatePricingDefaults`, `contracts.validateAnalysis`).
- **OpenAI-safe tool names**: OpenAI requires tool/function names to match `^[a-zA-Z0-9_-]+$`. Internally we keep dotted identifiers (e.g. `roles.list`), but when calling the LLM we:
  - Generate OpenAI-safe names by replacing invalid characters with `_`.
  - Keep a mapping from OpenAI-safe name back to the internal MCP tool name so that tool execution and side-effect routing still use the dotted identifiers.
- **Chat flow**: `lib/copilot/actions.ts` (`chat.run`) sends the user’s message history plus the tool definitions to the LLM. If the model returns tool calls, we:
  - Look up the corresponding MCP tool in `MCP_TOOLS`.
  - Execute it via the MCP server.
  - Run any configured side effects from the `SIDE_EFFECTS` registry.
  - Append tool and side-effect messages to the chat transcript that the UI renders.

### Side-Effect Mapping

Certain tools trigger additional domain behavior automatically:

- **WBS → Quote**: `estimates.generateWbsItems` runs `recalculateQuoteTotals`, which recalculates the quote based on the new WBS items, preserving existing payment terms/timeline.
- **Quote → Contracts**:
  - `quote.generateTerms` runs:
    - `saveQuoteTerms` to persist the generated payment terms and timeline onto the quote.
    - `markLinkedAgreementsStale` to flag that linked agreements may need re-validation.
- **Pricing defaults**:
  - `quote.updatePricingDefaults` calls `updatePricingDefaultsForFutureQuotesOnly`, which updates an in-memory global default overhead fee used for *future* quotes.
  - Existing quotes are **not** backfilled; they retain their stored overhead fee and total. Regeneration is an explicit action.
- **Roles → Quotes**:
  - `roles.update` runs `recalculateQuotesForRoleProjects`, which currently returns a note reminding users that existing quotes are not automatically recalculated.
- **Contracts validation**:
  - `contracts.validateAnalysis` runs `recordValidationSnapshot`, which currently returns a note that validation analysis has completed (hook for future persistence).
- **Contracts proposals**:
  - `contracts.applyProposals` applies accepted review proposals, saves a new agreement version, and clears the pending review state.

### Copilot Chat UI Wiring

The global Copilot UI is wired to the backend chat action as follows:

- `components/copilot/copilot-context.tsx`: manages chat state (`messages`, `inputValue`, `isChatOpen`, `isChatLoading`, `chatError`) and exposes a `runChat` function that calls the `chat.run` action via `useCopilotAction("chat.run")`.
- `components/copilot/copilot-shell.tsx`: wraps the app with a floating bottom-center chat bar and a right-hand chat sidebar. Both use `runChat` from the Copilot context instead of mock responses.
- `components/copilot/chat-interface.tsx`: renders the full chat sidebar with a scrollable message log and bottom-fixed input, showing a “Thinking…” bubble while `isChatLoading` is true.
- `components/copilot/copilot-params-injector.tsx`: injects page-specific context (workflow, entityId, view) into the Copilot context so the LLM has access to the current project/agreement when deciding which tools to call.

## Testing

Vitest covers the most critical service logic (ordered stage transitions + WBS CRUD) via a lightweight Prisma mock in `tests/estimatesService.test.ts`.

```bash
npm run test
```

### Mocked Copilot suite

Run the fast, offline Copilot tests (mocks `callProviderLLM`) via:

```bash
npm run test:mocked-copilot
```

These specs exercise Copilot handlers, policy actions, and review-state merges without hitting OpenAI. Use this suite for day-to-day development; keep the OpenAI integration tests (`npm run test:openai` / `npm run test:integration`) for gated validation.

### OpenAI integration tests

The end-to-end Copilot/API/MCP specs live under `tests/integration/` and remain **opt-in** so CI stays fast.

```bash
bash -lc 'set -a && source env/test.env && set +a && npm run test:integration'
```

Workflow:

1. `npm run db:test:up` (starts the Dockerized Postgres test instance on port 5440).
2. `DOTENV_CONFIG_PATH=env/test.env npx prisma migrate deploy` (first run per database).
3. `npm run test:integration` (wrapper around Vitest with `RUN_OPENAI_TESTS=1`, shared seed helpers, and the real MCP/OpenAI stack).

Optional knobs:
- `DATABASE_URL_OPENAI` → explicit Postgres URL for MCP/OpenAI tests (still defaults to `DATABASE_URL` unless `SEED_DB_TARGET` forces another DSN).
- `DATABASE_URL_TEST` → DSN used when `SEED_DB_TARGET=test`.
- `OPENAI_TEST_TIMEOUT` → override the default 120s per-spec timeout.
- `SEED_DB_TARGET` / `SEED_DATABASE_URL` → steer the shared seeders to any environment before tests run.
- `SEED_SIZE=large` → stress-mode dataset (more projects, artifacts, WBS rows).

The harness resets Prisma tables for each suite and seeds deterministically via `prisma/seedData.ts`, guaranteeing that both CLI seeds and integration specs share the same fixtures (including provenance-tagged artifacts). `copilotApi.integration.test.ts` exercises `/api/copilot` end to end, while `mcpTools.integration.test.ts` drives the lower-level MCP tools (`summarizeArtifact`, `llm.chat`, `roles.*`, `estimates.generateSolutionArchitecture`, `estimates.generateWbsItems`, `quote.*`). `tests/integration/seededData.integration.test.ts` validates that the seeded data keeps the UI routes and quote export APIs healthy.

### Copilot / LLM troubleshooting

- Ensure `.env` has:
  - `OPENAI_API_KEY` (or `LLM_API_KEY`)
  - `OPENAI_MODEL` (or `LLM_MODEL`) pointing at a chat-capable model such as `gpt-4o-mini`
  - Reasonable limits for `LLM_TIMEOUT_MS`, `LLM_MAX_OUTPUT_TOKENS`, and `COPILOT_ARTIFACT_CONTEXT_TOKEN_LIMIT`.
- To verify basic connectivity, call the Copilot debug action:

  ```bash
  curl -X POST http://localhost:3000/api/copilot \
    -H "Content-Type: application/json" \
    -d '{
      "action": "debugPingLLM",
      "payload": { "message": "Reply with the single word: PONG." }
    }'
  ```

- When `ENABLE_LLM_LOGGING=true`, business case generations log:
  - Prompt token/character counts (digest vs. raw artifacts).
  - The completion token budget and basic LLM response shape.
  - A warning if the LLM returns no business case content.

## Database Health Check

Ensure the app can reach Postgres:

```bash
curl http://localhost:3000/api/health/db
```

It returns `{ "status": "ok" }` when the Prisma client (from `lib/db`) successfully runs `SELECT 1`.

## Docker runtime

Docker Compose now bootstraps the web app, Prisma migrations, deterministic seeds, and the optional Apollo dataset in a single command.

1. Copy `.env.example` to `.env`, set `OPENAI_API_KEY`, and update `DATABASE_URL` so the host portion is `postgres`. (Keep a note of the `localhost` variant if you also run `npm run dev` directly.)
2. Optional: set `RUN_DEMO_SEED=true` in `.env` to load the Apollo agreements dataset immediately after the baseline seed completes.
3. Build and start the stack:

   ```bash
   docker compose up --build
   ```

   - The `app` container waits for the Postgres healthcheck, runs `npx prisma migrate deploy`, executes `npm run seed`, conditionally runs `npm run seed:demo`, and **then** launches `next start`.
   - Healthchecks hit `http://localhost:3000/api/health/db`, so `docker compose ps` only reports `healthy` after migrations + seeds have finished.
   - User uploads persist via the `./uploads:/app/uploads` bind mount.

4. Stop everything with `Ctrl+C` (foreground) or `docker compose down`. Use `docker compose down -v` when you need a blank Postgres volume and empty uploads folder.

### Useful Compose commands

- Tail logs: `docker compose logs -f app`
- Rebuild only the app image layer: `docker compose build app`
- Start the optional test database: `docker compose --profile test up postgres-test`
- Smoke test the running app: `curl http://localhost:3000/api/health/db`
