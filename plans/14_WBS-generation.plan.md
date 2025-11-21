# Effort Stage MCP Plan

## Todos

- schema-updates: Extend zod+service layers for WBS generation inputs/results
- mcp-wbs-tool: Add MCP tool, prompt, and OpenAI function for WBS generation
- copilot-flow: Wire new copilot action + UI/advance-stage hooks
- integration-tests: Cover API/MCP flows for Effort stage
- docs-testing: Update README/TESTING for WBS automation

## 1. Schema & Service Updates (`lib/zod/estimates.ts`, `lib/services/estimatesService.ts`)

- Add `generateEffortFromSolutionInputSchema` and types for WBS generation requests.
- Ensure `saveStageContent`/`mapStageToDelegate` (or new helpers) can persist `EFFORT` data via structured `WbsItemInput[]` writes using `updateWbsItems` internally.

## 2. MCP “generate_wbs_items” Tool (`lib/mcp/types.ts`, `lib/mcp/client.ts`, `lib/mcp/server.ts`, `lib/copilot/prompts/wbs.ts`)

- Introduce a new MCP tool id (e.g., `estimates.generateWbsItems`) whose request payload includes project metadata and optional instructions.
- Build a prompt helper that feeds artifacts + Business Case + Requirements + Solution summaries into a structured WBS template and enforces JSON output.
- In `mcp/server`, register a handler that:
- Loads artifact context plus existing stage content.
- Calls OpenAI with `response_format: json_object` and validates the returned list of `{ task, role, hours }` entries.
- Returns the parsed items (and raw context) to callers, throwing when validation fails.

## 3. Copilot & UI Flow (`lib/copilot/actions.ts`, `app/estimates/actions.ts`, `app/estimates/[projectId]/stage-panels.tsx`)

- Add `generateEffortFromSolution` action that calls the MCP tool, persists new WBS rows via `updateWbsItems`, and returns the structured set.
- Update `advanceStageAction` to auto-run this action when moving from Solution → Effort, mirroring previous stages’ error handling.
- In the stage panel UI, enable a “Regenerate Effort with Copilot” control within the WBS editor that triggers the new action and refreshes the table.

## 4. Integration Coverage (`tests/integration/copilotApi.integration.test.ts`, `tests/integration/mcpTools.integration.test.ts`, `tests/integration/openaiTestHarness.ts`)

- Extend the API suite to drive `/api/copilot` with the new action and assert it stores WBS items for the seeded project.
- Add an MCP-level test hitting `estimates.generateWbsItems` directly to verify the JSON response is well-formed and contains plausible rows.
- Update the harness seed (if needed) so Effort tests have prerequisites (Business Case, Requirements, Solution drafts).

## 5. Docs & DX (`README.md`, `TESTING.md`, `.env.example` if exposed knobs)

- Document the Effort stage automation, the new MCP tool, and any env flags/token budgets (e.g., `LLM_EFFORT_MAX_OUTPUT_TOKENS`).
- Note the expanded OpenAI integration coverage and runtime implications.