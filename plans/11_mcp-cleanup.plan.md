# MCP Cleanup & Consistency Plan

## 1. Normalize MCP request/response types and errors
- Update `lib/mcp/types.ts` to require both `projectId` and `projectName` where applicable (e.g., artifact summaries, business case requests) so the server has consistent context.
- Introduce a shared error helper (e.g., `lib/mcp/errors.ts`) that converts provider errors into `CopilotLLMError`, and ensure both the MCP server and `app/api/copilot/route.ts` propagate structured errors.
- Replace duplicated message types: rely on `CopilotLLMMessage` everywhere (MCP server, client, llmClient) and remove `McpChatMessage` if it adds no additional semantics; add a helper to coerce roles when needed.

## 2. Consolidate prompt builders under `lib/copilot/prompts`
- Ensure all prompt construction (business case, artifact summaries, any other stage-specific prompts) lives entirely within `lib/copilot/prompts/`; refactor remaining sites in MCP server or legacy helpers to import from there.
- Remove any direct prompt string assembly in `lib/mcp/server.ts` or other modules; they should only invoke prompt builders.

## 3. Trim legacy LLM helpers and redundant mocks
- Remove unused exports from `lib/copilot/llmClient.ts` (or collapse the file entirely into a thin MCP proxy) now that direct HTTP usage is encapsulated in `lib/mcp/providerClient.ts`.
- Update tests (`tests/copilotActions.test.ts`, `tests/artifactSummaries.test.ts`, others) to mock only the MCP client helpers; delete stale mocks for `buildArtifactContext`, `buildBusinessCasePrompt`, etc., that no longer influence behavior.
- Search for remaining `generateEstimateStageDraft` / `summarizeDocument` imports and replace them with MCP client calls or remove them entirely.

## 4. Cleanup redundant legacy code paths and ensure server/client parity
- Verify no other modules (actions, services) still import `lib/copilot/llmClient.ts` or call OpenAI endpoints directly; remove any such references.
- Make sure MCP server responses are the single source of truth for Copilot errors: `app/api/copilot/route.ts` should rely on the MCP client’s `CopilotLLMError` and not wrap errors differently.
- Add a shared helper in the MCP client/server layer for converting provider responses so patterns stay consistent (e.g., trimming content, handling finish reasons).

## 5. (Optional after cleanup) Confirm end-to-end flow
- After refactoring, run the existing test suite and smoke test the business case generation path (seed project → advance stage) to ensure the cleaned-up MCP integration behaves the same.
