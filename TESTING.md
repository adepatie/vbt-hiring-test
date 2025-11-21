## Testing Guide

This project has a mix of fast unit tests, mocked Copilot tests, and opt‑in OpenAI integration tests.

## 1. Quick smoke checks

For basic validation during development:

- `npm run lint` – static analysis.
- `npm run dev` – start the app and confirm the dashboard renders.

## 2. Unit & component tests (no external APIs)

Use the main test suite for fast feedback without hitting OpenAI or a real database:

```bash
npm run test
```

This runs Vitest over `tests/**/*.test.{ts,tsx}` **excluding** `tests/integration/**` and currently covers:

- **Artifacts & seed helpers**
  - Artifact summarization utilities (`tests/artifactSummaries.test.ts`).
  - Artifact content extraction helpers (`tests/artifactContentUtils.test.ts`).
  - Artifact ingestion (file uploads → summaries → DB payloads) (`tests/artifactIngest.test.ts`).
  - Dev seed workflow (`tests/devSeed.test.ts`) ensuring all four `SAMPLE_ARTIFACTS` are ingested via `seedDevProject`.

- **Estimates & WBS logic**
  - Stage transition validation and guardrails.
  - WBS CRUD helpers and aggregation (role IDs must exist, rates rounded to cents, and stale rows pruned) in `tests/estimatesService.test.ts`.
  - Zod schema validation for estimates data in `tests/zod/estimatesSchema.test.ts`.

- **Contracts & review**
  - Policy and example‑agreement server actions validation (`tests/contracts/policyActions.test.ts`).
  - `saveReviewStateAction` proposal ID hashing and decision handling (`tests/contracts/reviewActions.test.ts`).
  - The contracts review UI flow (`tests/contracts/reviewInterface.test.tsx`).

- **Copilot & MCP plumbing (mocked)**
  - Copilot prompt construction and handler behavior (`tests/copilotPrompts.test.ts` and `tests/copilot/**/*.test.ts`).
  - MCP registry wiring (`tests/mcpRegistry.test.ts`).
  - Copilot chat UI behavior (`tests/copilot/chatUI.test.tsx`).

- **Services & misc**
  - Contracts dashboard stats (`tests/services/contractsService.test.ts`).
  - Settings service behavior (`tests/services/settingsService.test.ts`).

As you add features, prefer extending these suites and list any notable new coverage here.

## 3. Mocked Copilot fast suite

Use this when you want to exercise Copilot handlers end‑to‑end without any real OpenAI calls:

```bash
npm run test:mocked-copilot
```

This command:

- Sets `MOCK_COPILOT=1`.
- Runs the specs under `tests/copilot/**`, which:
  - Stub `callProviderLLM` via `tests/copilot/__mocks__/providerClient.ts` so MCP / Copilot handlers can be tested deterministically.
  - Validate quote term generation, tool‑call execution, chat UI behavior, and related utilities.

> Note: The contracts action and UI tests in `tests/contracts/**` are part of the main `npm run test` suite, not `test:mocked-copilot`.

Pair `npm run test` and `npm run test:mocked-copilot` for day‑to‑day development; reach for the OpenAI suites (below) only when you need real completions.

## 4. Seeded OpenAI integration suites

OpenAI integration tests live under `tests/integration/` and are intentionally **opt‑in** to keep `npm run test` fast and free.

### 4.1. Start the disposable Postgres instance

The OpenAI suites use the `postgres-test` container defined in `docker-compose.yml`:

```bash
npm run db:test:up
```

And to stop/reset:

```bash
npm run db:test:down    # stop
npm run db:test:reset   # drop & recreate
```

### 4.2. Prepare the environment

- Edit `env/test.env` and set a **real** `OPENAI_API_KEY` (or `LLM_API_KEY`).
- Ensure the DSNs point at the test Postgres instance (defaults match `docker-compose.yml`):

  ```env
  DATABASE_URL=postgresql://vbt:vbt@localhost:5440/vbt_hiring_test_test
  DATABASE_URL_OPENAI=postgresql://vbt:vbt@localhost:5440/vbt_hiring_test_test
  DATABASE_URL_TEST=postgresql://vbt:vbt@localhost:5440/vbt_hiring_test_test
  RUN_OPENAI_TESTS=1
  ```

- The integration scripts set `DOTENV_CONFIG_PATH=env/test.env`, and the harness (`tests/integration/openaiTestHarness.ts`) uses `dotenv/config`, so these values are picked up automatically.

### 4.3. Full integration suite

To run **all** OpenAI integration specs:

```bash
npm run test:integration
```

This command:

- Sets `DOTENV_CONFIG_PATH=env/test.env` and `RUN_OPENAI_TESTS=1`.
- Points Prisma at the Docker test DB (`DATABASE_URL_OPENAI` / `DATABASE_URL`).
- Seeds via the shared `prisma/seedData.ts` helpers (through `tests/helpers/seedTestDb.ts`).
- Executes every spec under `tests/integration/**`.

**Coverage highlights:**

- **`copilotApi.integration.test.ts`**
  - `/api/copilot` end‑to‑end for Business Case, Requirements, Solution Architecture, WBS/Effort, Quote term generation, and the `debugPingLLM` sanity check.

- **`mcpTools.integration.test.ts`**
  - MCP tool surface: `llm.chat`, `roles.*`, `estimates.*`, `quote.*` hitting the **real** OpenAI Chat Completions endpoint.

- **`contracts.test.ts` & `contractGeneration.test.ts`**
  - Contract generation flows and agreement lifecycle against seeded data.

- **`seededData.integration.test.ts`**
  - Verifies seeded projects, provenance‑tagged artifacts, and quote export routes stay healthy.

- **`openaiTestHarness.ts`**
  - Centralizes DB connection, seeding, and gating logic so both CLI seeds (`prisma/seed.ts`, `prisma/seedData.ts`) and tests share fixtures.

You can set:

```bash
SEED_SIZE=large
```

before `npm run test:integration` (or `npx prisma db seed`) to fan out additional “stress” projects (more artifacts and WBS rows) for performance testing.

### 4.4. Targeted OpenAI checks

For narrower OpenAI runs:

- **Copilot + MCP only (no contracts):**

  ```bash
  npm run test:openai
  ```

  Runs just:

  - `tests/integration/copilotApi.integration.test.ts`
  - `tests/integration/mcpTools.integration.test.ts`

- **Contract generation only:**

  ```bash
  npm run test:contracts:gen
  ```

  Runs:

  - `tests/integration/contractGeneration.test.ts`

Both commands still respect `env/test.env` via `RUN_OPENAI_TESTS` and the same OpenAI / DB env vars as the full `test:integration` suite.


