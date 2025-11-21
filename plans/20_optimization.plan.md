# System Optimization Plan: GPT Request Performance

## 1. Critical Issues Identified

### A. Context Loss on Truncation (Bug)
- **Current Behavior**: In `lib/copilot/prompts/estimates.ts`, if `artifactsRawTextTruncated` is true, the prompt switches to using `artifactsSummary`.
- **Root Cause**: `artifactsSummary` (populated from `digestText` in `lib/copilot/context/estimates.ts`) only contains **metadata** (filenames, sizes), not content.
- **Impact**: When artifacts exceed the tiny 2600 token limit, the LLM loses ALL access to file content and only sees filenames. It cannot generate a Business Case.

### B. Aggressive Token Limits
- **Current Limit**: `ARTIFACTS_RAW_TEXT_TOKEN_LIMIT` is hardcoded to `2600` tokens.
- **Reality**: GPT-4o has a 128k context window. 2600 is < 2% of capacity.
- **Fix**: Increase default to **40,000** tokens.

### C. Resilience
- **No Retries**: `callProviderLLM` fails immediately on 429 (Rate Limit) or 5xx errors.
- **Fix**: Implement exponential backoff (3 retries).

### D. Type Safety
- **`any` usage**: `providerClient.ts` uses unsafe casting for LLM responses.
- **Fix**: Use Zod to parse the OpenAI response structure.

## 2. Implementation Steps

### Step 1: Resilience & Safety (`lib/mcp/providerClient.ts`)
- Add `retryWithBackoff` wrapper around the fetch call.
- Define Zod schemas for `OpenAIChatCompletionResponse`.
- Replace `any` casting with safe parsing.

### Step 2: Context Capacity (`lib/copilot/context/estimates.ts`)
- Update `ARTIFACTS_RAW_TEXT_TOKEN_LIMIT` to `40000`.
- (Optional) Improve `estimateTokenCount` to be slightly more accurate (avg 3.5 chars/token instead of 4).

### Step 3: Prompt Logic (`lib/copilot/prompts/estimates.ts`)
- Remove the binary switch that hides raw text when truncated.
- Instead, pass *as much raw text as possible* (up to the limit) and append a "Truncated..." notice, rather than falling back to metadata only.

### Step 4: Cleanup (`lib/mcp/server.ts`)
- Remove duplicate `truncateForPrompt` if possible or consolidate.
- Improve error handling for `JSON.parse`.

## 3. Verification
- Run existing integration tests (`tests/integration/mcpTools.integration.test.ts`).
- Verify that large artifacts (e.g., > 10kb text) are now successfully included in the Business Case prompt.

