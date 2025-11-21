# Solution Architecture MCP Plan

## Todos

- schema-hooks: Extend zod schemas + stage automation
- mcp-solution-tool: Add solution prompt + MCP tool wiring
- copilot-ui: Expose new action + regenerate UX
- integration-tests: Expand OpenAI integration coverage
- docs-testing: Document new stage + test instructions

## 1. Schema & Stage Hooks (`lib/zod/estimates.ts`, `app/estimates/actions.ts`)

- Add `generateSolutionFromRequirementsInputSchema` / type and export it for Copilot.
- Update `app/estimates/actions.ts` to auto-run the Solution generator when advancing from Requirements → Solution (mirror the Requirements hook) and ensure errors bubble with revalidation just like other stages.

## 2. MCP Solution Tooling (`lib/mcp/types.ts`, `lib/mcp/client.ts`, `lib/mcp/server.ts`, `lib/copilot/prompts/solution.ts`)

- Introduce a new MCP tool id `estimates.generateSolutionArchitecture` plus request interfaces and client helper.
- Create `lib/copilot/prompts/solution.ts` describing the output structure (Documented Approach, Architecture, Tech Stack, Risks) and consuming artifact digest, Business Case (truncated), and Requirements.
- On the server:
- Load/truncate Business Case + Requirements (with new `LLM_SOLUTION_*` env guards) from `buildArtifactContext`.
- Call the new prompt builder with budgets similar to Requirements.
- Return trimmed content and finish metadata.

## 3. Copilot Action & UI Regeneration (`lib/copilot/actions.ts`, `app/estimates/[projectId]/stage-panels.tsx`)

- Wire a `generateSolutionArchitectureFromRequirements` action that validates input, calls the new MCP tool, persists to the `SOLUTION` stage record, and mirrors error handling from prior stages.
- Update `copilotActions` exports and `NarrativeStageForm` regeneration config so Solution editors can trigger Copilot redraws, plus ensure `advanceStageAction` uses the new action automatically.

## 4. Integration Coverage (`tests/integration/copilotApi.integration.test.ts`, `tests/integration/mcpTools.integration.test.ts`, `tests/integration/openaiTestHarness.ts` if needed)

- Extend the Copilot API integration suite to invoke the new action after Requirements, assert 200 responses, non-empty drafts, and DB persistence (`solutionArchitecture` row).
- Add an MCP-level test that hits `estimates.generateSolutionArchitecture` directly (after seeding a project with Business Case + Requirements or by reusing the API flow) to ensure OpenAI calls succeed and include expected sections.

## 5. Docs & Test Guidance (`README.md`, `TESTING.md`)

- Update documentation to mention the Solution Architecture stage, new Copilot action name, and any env knobs (`LLM_SOLUTION_MAX_OUTPUT_TOKENS`, etc.).
- Document how to run the OpenAI suite now that it covers an additional stage (note the longer runtime/budget implications).