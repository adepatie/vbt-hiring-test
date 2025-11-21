# VBT Workflow Copilot

Thin-slice implementation of the Estimates + Contracts workflows from `spec/ARCHITECTURE.md`.  
Runs on shadcn UI + Tailwind, Prisma (Postgres), and an MCP Copilot stack.

## Quick Start (Docker)

The easiest way to run the application is with Docker.

1.  **Configure Environment**
    Copy `.env.example` to `.env` and add your `OPENAI_API_KEY`:
    ```bash
    cp .env.example .env
    # Edit .env to set OPENAI_API_KEY
    ```

2.  **Start the Application**
    ```bash
    docker compose up --build
    ```
    The app will be available at [http://localhost:3000](http://localhost:3000).
    *Note: The startup process automatically applies migrations and seeds baseline data.*

## Demo Data

To load the optional Apollo agreements dataset (recommended for testing):

**Option A: Automatic (via Env)**
Set `RUN_DEMO_SEED=true` in your `.env` file before running `docker compose up`.

**Option B: Manual (via CLI)**
Run the seed command inside the running container:
```bash
docker compose exec app npm run seed:demo
```

---

## Local Development (No Docker)

If you prefer running Node locally:

1.  **Install dependencies**: `npm install`
2.  **Start Postgres**: `npm run db:up`
3.  **Configure .env**: 
    -   Set `DATABASE_URL` to `postgresql://vbt:vbt@localhost:5432/vbt_hiring_test` (host is `localhost` instead of `postgres`).
    -   Set `OPENAI_API_KEY`.
4.  **Setup Database**:
    ```bash
    npx prisma generate
    npx prisma migrate deploy
    npm run seed
    ```
5.  **Run App**: `npm run dev`

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Database connection string. |
| `OPENAI_API_KEY` | Yes | OpenAI API key for the Copilot. |
| `RUN_DEMO_SEED` | No | Set to `true` to auto-load demo data on startup. |
| `ENABLE_LLM_LOGGING` | No | Set to `true` for detailed LLM logs. |

## Workflow Overview

### Estimates Workflow (Phase 1)
-   **Lists**: `/estimates` - Create and manage project estimates.
-   **Stages**:
    -   **Artifacts**: Upload requirements docs.
    -   **Business Case / Requirements / Solution**: AI-assisted drafting.
    -   **Effort Estimate**: WBS editor with Copilot generation.
    -   **Quote**: Pricing breakdown and payment terms.

### Copilot Architecture
The app uses the **Model Context Protocol (MCP)** to bridge the UI and LLM.
-   **Server**: `lib/mcp/server.ts` hosts tools (e.g., `generateWbsItems`, `chat`).
-   **Client**: `lib/mcp/client.ts` connects the app to the MCP server.
-   **Chat**: A global chat interface (`cmd+k` or click the bubble) allows interaction with project context.

## Testing

-   **Unit Tests**: `npm run test`
-   **Mocked Copilot**: `npm run test:mocked-copilot` (No API key needed)
-   **Integration Tests**: `npm run test:integration` (Requires OpenAI key)

## Project Structure

-   `app/`: Next.js App Router pages and API routes.
-   `components/`: React components (shadcn/ui).
-   `lib/mcp/`: MCP server, client, and tool definitions.
-   `prisma/`: Database schema and seed scripts.
-   `spec/`: Architecture documentation.
