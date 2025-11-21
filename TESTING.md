# Testing Plan (Bootstrap)

Automated tests will be added once key server actions exist. For now:

1. **Smoke checks**
   - `npm run lint`
   - `npm run dev` to ensure the dashboard renders.

2. **Upcoming required tests (per spec)**
   - Stage transition validation.
   - WBS aggregation and validation helpers.
   - Agreement versioning + proposal application service.

## Automated coverage

- `npm run test` now exercises:
  - Artifact summarization utilities.
  - The artifact ingestion helper (file uploads → summaries → DB).
  - The developer seed workflow (ensures the helper is invoked for all four sample artifacts).
  - Estimates service logic: ordered stage transitions plus the role-backed WBS CRUD helpers (role IDs must exist, rates are rounded to cents, and stale rows are pruned).

As each feature lands, document how to run its tests here along with any data setup instructions.

## Mocked Copilot suite

Use the lightweight mocked suite when you want fast feedback without touching OpenAI:

```bash
npm run test:mocked-copilot
```

This command sets `MOCK_COPILOT=1` and runs the specs under `tests/copilot` and `tests/contracts`, which:

- Stub `callProviderLLM` so Copilot handlers can be exercised deterministically.
- Validate the policy admin server actions’ Zod parsing.
- Ensure `saveReviewStateAction` merges proposal decisions via the new hashed IDs.

Pair this suite with `npm run test` for day-to-day development; reach for the OpenAI suite (below) only when you need real completions.

## Seeded OpenAI integration suite

Real API integrations live under `tests/integration/` and are intentionally **opt-in** so day‑to‑day `npm run test` stays fast.

1. **Start the disposable Postgres instance**
   ```bash
   npm run db:test:up
   ```
   (Use `npm run db:test:down` / `npm run db:test:reset` as needed.)

2. **Prepare the environment**
   - Copy `env/test.env` and set a real `OPENAI_API_KEY`.
   - Ensure the MCP server can reach the same OpenAI account (the suite loads `DOTENV_CONFIG_PATH=env/test.env` automatically).

3. **Run the suite**
   ```bash
   npm run test:integration
   ```
   This command sets `RUN_OPENAI_TESTS=1`, points Prisma at the Docker DB, seeds it via the shared dataset helpers, and executes every spec under `tests/integration/`.

4. **Coverage**
   - `/api/copilot` end-to-end behavior for Business Case, Requirements, Solution Architecture, Effort/WBS, Quote term generation, and the `debugPingLLM` sanity check.
   - The MCP tool surface (`llm.chat`, `roles.*`, `estimates.*`, `quote.*`) hitting the **real** OpenAI Chat Completions endpoint—no mocks.
   - Seed verification (`tests/integration/seededData.integration.test.ts`) exercises `estimatesService` plus the quote export route to confirm the Prisma seed keeps pages loadable.
   - The harness (`tests/integration/openaiTestHarness.ts`) now reseeds via the shared `prisma/seedData.ts` helpers so both the CLI seed and the tests use identical fixtures (including provenance-tagged artifacts).
   - Set `SEED_SIZE=large` before running `npm run test:integration` (or `npx prisma db seed`) to fan out extra stress projects for load/perf investigations.

Expect ~2–3 minutes of runtime (Solution + Effort generations add a couple of medium completions) plus OpenAI token usage for several medium responses. The suite aborts early with a clear error when the required env vars are missing or when Prisma cannot reach the configured test database.

