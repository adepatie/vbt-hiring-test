# MCP-based LLM Integration for Business Case Generation

## 1. Inventory current LLM usage and business case flow

- Map all call sites that currently touch the LLM:
- `lib/copilot/llmClient.ts` (`callLLM`, `generateEstimateStageDraft`, `summarizeDocument`).
- `lib/copilot/actions.ts` (`generateBusinessCaseFromArtifacts`).
- `lib/server/artifact-summary.ts` (artifact summarization for storage and prompt preparation).
- Any other Copilot-related modules (e.g., contracts prompts) that rely on `llmClient`.
- Confirm how the business case flow is triggered:
- UI: `app/estimates/[projectId]/stage-panels.tsx` (Business Case regeneration button).
- Server actions: `app/estimates/actions.ts` (`advanceStageAction` now calling `copilotActions.generateBusinessCaseFromArtifacts`).
- Copilot API: `app/api/copilot/route.ts` dispatching to `copilotActions`.

## 2. Design the MCP server API surface

- Define an MCP server dedicated to LLM operations, with tools that align with current use cases:
- `llm.chat` (generic chat-style completion used by higher-level helpers).
- `estimates.generateBusinessCaseFromArtifacts` (business-case specific tool taking `projectId`, optional instructions).
- `estimates.summarizeArtifact` (used by artifact summary logic).
- Specify request/response shapes for each tool, including:
- Minimal fields needed by the app (e.g., `content`, `finishReason`, and optional metadata like token counts).
- A normalized error envelope (e.g., `kind`, `message`, `status`) that maps cleanly to the existing `CopilotLLMError` semantics.
- Decide on configuration boundaries:
- MCP server owns all provider config (`OPENAI_API_KEY`, `OPENAI_MODEL`, timeouts, token limits).
- The app passes only logical parameters (project IDs, instructions, raw text) to MCP, with no direct OpenAI references.

## 3. Implement the MCP server (no HTTP, in-process)

- Create a new module (e.g., `lib/mcp/llmServer.ts`) that implements an MCP server according to the Model Context Protocol:
- Expose tools for `llm.chat`, `estimates.generateBusinessCaseFromArtifacts`, `estimates.summarizeArtifact`.
- Internally, wire these tools to the existing provider using the current `callLLM` logic (or equivalent), but keep this confined to the MCP server.
- Ensure the server:
- Reads all LLM-related env vars (`OPENAI_API_KEY`, `OPENAI_MODEL`, timeouts, token limits).
- Centralizes prompt construction where appropriate (or delegates to existing prompt builders for business case / artifact summaries).
- Emits structured errors that can be mapped back by the app layer.
- Structure the server in a way that allows adding future tools (e.g., requirements, solution, quote generation) without changing the app’s integration pattern.

## 4. Implement an MCP client wrapper for the app layer

- Add a thin client module (e.g., `lib/mcp/client.ts`) that:
- Manages the in-process connection to the MCP server (no HTTP), using MCP client primitives.
- Provides typed functions like `mcpChat`, `mcpGenerateBusinessCaseFromArtifacts`, and `mcpSummarizeArtifact`.
- Translates MCP errors into `CopilotLLMError` (or a successor error type) so existing error handling paths remain consistent.
- Keep the client API narrow and domain-oriented so the rest of the app never needs to know about MCP details or underlying OpenAI specifics.

## 5. Refactor existing LLM helpers to use MCP

- Replace direct provider usage in `lib/copilot/llmClient.ts`:
- Either refactor `llmClient` into a thin adapter over the MCP client (so `generateEstimateStageDraft` and `summarizeDocument` become MCP calls), or
- Deprecate/remove `llmClient` entirely and call the MCP client directly from `copilot/actions.ts` and `artifact-summary.ts`.
- Update higher-level logic to rely on MCP-backed helpers:
- `lib/copilot/actions.ts` should call MCP via the new client for business case generation.
- `lib/server/artifact-summary.ts` should call MCP via the client for document summarization.
- Any other Copilot integrations (e.g., contracts) should migrate to the MCP client instead of direct HTTP/OpenAI.
- Ensure there is no remaining direct `fetch` to OpenAI or direct use of `OPENAI_*` / `LLM_*` env vars in the app layer; those belong exclusively in the MCP server.

## 6. Clean up legacy code and configuration

- Remove or simplify now-obsolete pieces:
- Any direct HTTP provider calls or low-level response parsing in `lib/copilot/llmClient.ts` if it’s no longer used.
- Redundant error types / utilities if they duplicate MCP error semantics.
- Search for and eliminate legacy LLM integration points:
- Grep for `OPENAI_`, `LLM_`, direct `/v1/chat/completions`, etc., outside the MCP server implementation.
- Update env and documentation expectations so developers know that:
- All LLM traffic flows through the MCP server.
- New LLM features should be implemented as MCP tools, not as direct HTTP calls.

## 7. Extend tests and documentation

- Testing:
- Add unit tests for the MCP client wrapper to verify tool calls and error mapping.
- Adjust existing tests that mocked `generateEstimateStageDraft` / `summarizeDocument` to instead mock the MCP client where appropriate.
- (Optionally) add higher-level tests that exercise business case generation and artifact summarization through the MCP path to guard against regressions.
- Documentation:
- Update `README.md` and `AI_ARTIFACTS.md` to describe:
  - The new MCP-based architecture for LLM calls.
  - Key env vars and how they are consumed by the MCP server.
  - How to add new LLM-powered features by adding MCP tools and then calling them via the MCP client from the app layer.