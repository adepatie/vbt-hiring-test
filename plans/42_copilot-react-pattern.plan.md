# Plan: Copilot Agent Loop (ReAct Pattern, Refined)

The goal is to refactor the `chatRun` function in `lib/copilot/actions.ts` into a robust Agent Loop (ReAct pattern) that:

- Allows the Copilot to chain multiple tool calls (e.g., `getProjectDetails` → `listRoles` → `updateWbsItems`).
- Ensures **every interaction ends with an LLM-generated conversational response**.
- Preserves existing side-effect behavior and rate limiting.
- Controls cost and latency via careful history and tool handling.

## 1. Agent Loop Structure in `chatRun`

In `lib/copilot/actions.ts`, replace the current 2-turn pattern with a loop:

1. **Initialize**

- Parse input with the existing `chatInputSchema`.
- Derive `workflow`, `entityId`, and `projectContext` as today.
- Compute `isReadOnlyContext` and `allowedToolSet` via `getAllowedToolSetForContext`.
- Build the `META_SYSTEM_PROMPT` exactly as today (including read-only messaging).
- Set `MAX_TURNS = 5` (or similar) and initialize `history` with the parsed messages.

2. **Loop Body (per turn)**

- Derive a **truncated history** window (see Section 2) from `history` to send to the LLM.
- Call `mcpChat` with:
 - `systemPrompt: META_SYSTEM_PROMPT`.
 - `messages: truncatedHistory`.
 - `tools: filteredTools` (from `filterToolsByAllowlist` + `getOpenAiToolNameMap`).
 - `toolChoice: "auto"` by default inside the loop.
- Inspect the response:
 - If it contains **no `tool_calls` and has non-empty `content`**, push an `assistant` message to `history` and **return**.
 - If it contains **`tool_calls`**, execute tools and side effects (Section 3), append resulting `tool` + `system` side-effect messages to `history`, then continue to the next loop iteration.

3. **Termination Conditions**

- Maintain a `turnCount` and break the loop if `turnCount >= MAX_TURNS`.
- Also break if the LLM returns **neither `tool_calls` nor content** on a turn (degenerate case).
- After breaking **without a good assistant message**, run one final LLM call (Section 4) with `toolChoice: "none"` to force a summary.

## 2. History & Cost Management

To keep tokens and latency under control, the loop must use a sliding window and compact messages:

1. **Sliding Window**

- Before each `mcpChat` call, build `truncatedHistory` from `history`:
 - Include at most the **last ~20 dialog turns** (user/assistant/tool/system) relevant to the current conversation.
 - Prefer to keep the most recent user query plus the tool/side-effect context that directly supports it.

2. **Compact Tool Messages**

- For tool outputs, avoid re-sending huge JSON payloads repeatedly:
 - Keep the full `tool` message in `history` for logging/UI.
 - For the LLM context, prefer to:
 - Use the existing `normalizeToolOutputContent` to get a **pretty but bounded** representation.
 - Optionally summarize heavy results using `summarizeToolExecutions` and include that summary as a short `system` message instead of re-sending full JSON.

3. **System Prompt Stability**

- Reuse the same `META_SYSTEM_PROMPT` on every LLM call in the loop.
- Do not dynamically grow the system prompt; keep dynamic context in `messages` only.

## 3. Tool Execution & Side Effects (No Duplication)

Extract and centralize tool execution & side-effect handling to keep the loop readable and prevent duplicate side effects:

1. **Helper: `executeToolCalls`** (new helper in `lib/copilot/helpers.ts` or co-located in `lib/copilot/actions.ts`)

- Input:
 - `toolCalls` (from the latest LLM response).
 - `openAiToolNameMap`, `MCP_TOOLS`, `allowedToolSet`.
 - `workflow`, `entityId`.
- Behavior (per tool call):
 - Map OpenAI name → internal name using `openAiToolNameMap`.
 - Validate registration with `MCP_TOOLS`.
 - Enforce `allowedToolSet` and call `assertMutationRateLimit(internalName, entityId)`.
 - Parse arguments with the tool’s Zod `schema`.
 - Execute the tool (`toolDef.execute(parsedArgs)`).
 - Normalize output via `normalizeToolOutputContent`.
 - Build a `ToolExecutionRecord` and accumulate in an array.
 - Build a corresponding `tool` message (`CopilotLLMMessage`) with compact content.
 - On errors (Zod, `CopilotLLMError`, generic):
 - Use `buildToolErrorPayload` to produce a friendly error object.
 - Log via `logToolInvocation` with `status: "error"` or `"blocked"`.
 - Still produce a `tool` message describing the error.

2. **Side Effects**

- After each successful tool execution, look up `SIDE_EFFECTS[internalName]`.
- For each handler:
 - Call it with `{ input: parsedArgs, result: toolResult.raw ?? toolResult.content, context: { workflow, entityId } }`.
 - If it returns a note, push a `system` message like `[Side Effect] ...` and set `shouldRefresh = true`.
 - If it throws, log and push a `system` message like `[Side Effect Error] ...` without failing the whole loop.
- Side effects are executed **once per new tool call** from the latest LLM response; the loop never re-runs previous `tool_calls`, so side effects are not duplicated.

3. **Helper Output**

- The helper should return:
 - `toolMessages: CopilotLLMMessage[]`.
 - `sideEffectMessages: CopilotLLMMessage[]`.
 - `executionSummaries: ToolExecutionRecord[]`.
 - `shouldRefresh: boolean`.

## 4. Final Summary Call (Forced LLM Response)

After executing tools & side effects for a turn, the loop will often need a follow-up natural-language response:

1. **Normal Loop Continuation**

- If there is still budget (`turnCount < MAX_TURNS`), include the new `tool` + side-effect messages in `history` and let the next loop iteration call the LLM with `toolChoice: "auto"` again.

2. **Forced Summary on Exit**

- When breaking out of the loop **without** a good `assistant` message available:
 - Build a `followUpHistory` slice that includes:
 - The last user messages leading up to the tools.
 - The assistant message that triggered the tools (if any).
 - The `tool` and side-effect messages from the last round.
 - Optionally, a short `system` summary built from `summarizeToolExecutions(executionSummaries)`.
 - Call `mcpChat` with:
 - `systemPrompt: META_SYSTEM_PROMPT`.
 - `messages: followUpHistory`.
 - `tools: filteredTools` (same set), but **`toolChoice: "none"`**.
 - If the LLM returns non-empty `content`, push it as an `assistant` message and return.
 - If content is still empty, fall back to pushing the `summaryText` from `summarizeToolExecutions` (if any), or a generic friendly message like:
 - "I’ve completed the requested operations, but the tools didn’t return any additional details."

## 5. Read-Only & Rate Limiting Invariants

Ensure the loop strictly maintains your existing safety guarantees:

1. **Read-Only Context**

- In read-only contexts (`isReadOnlyContext === true`):
 - Compute `allowedToolSet` with `{ readOnly: true }` and use that same set on **every** iteration.
 - Filter tools via `filterToolsByAllowlist` each time before calling `mcpChat`.
 - If the LLM requests a mutation tool, the `executeToolCalls` helper should:
 - Block it using `allowedToolSet`.
 - Return a friendly `tool_error` payload (via `buildToolErrorPayload`).
 - Log a `status: "blocked"` invocation.

2. **Rate Limiting**

- Preserve the existing `assertMutationRateLimit` behavior:
 - Call it on **each** mutation tool before executing it, passing `entityId`.
 - If it throws, surface that as a `tool_error` payload and continue the loop (no process crash).

## 6. Error Handling & User Experience

The loop should guarantee a friendly UX even when things go wrong:

1. **Tool / Side-Effect Errors**

- All tool and side-effect errors are captured as `tool_error` or `[Side Effect Error]` system messages.
- These messages should be part of `history` and available to the final summary call.

2. **Chat-Level Errors**

- For unexpected errors inside `chatRun` (e.g., `mcpChat` throws), wrap them in a `CopilotLLMError` with a clear, user-facing message.
- The API route (`app/api/copilot/route.ts`) already maps these to normalized JSON error structures for the UI.

3. **Guarantee: Always a Chat Message**

- The combination of:
 - The agent loop with `toolChoice: "auto"` while tools are needed.
 - A final `toolChoice: "none"` call on exit.
 - A fallback `summaryText` from `summarizeToolExecutions`.
- Ensures that for successful flows the user always receives an LLM-generated assistant message summarizing what happened, instead of only raw tool JSON.

## 7. Verification

1. **Basic Tool Chains**

- Example: "Show me the details for this project" (with a project selected):
 - Verify `estimates.getProjectDetails` is called, side effects (if any) run, and the final assistant message summarizes key fields.

2. **Multi-Step Chains**

- Example: "Create three WBS items and then update the quote totals".
 - Verify multiple tools can run in sequence within the same conversation and the final message clearly explains what changed.

3. **Read-Only Context**

- Lock a project and ask Copilot to mutate it.
- Verify tools are blocked with friendly errors and the final assistant message explains that the project is read-only.

4. **Error Scenarios**

- Force a bad tool input or trigger a rate limit.
- Confirm the final assistant message explains the error and suggests what to do next.

This refined plan keeps the agent loop aligned with your existing side-effect and safety infrastructure, while explicitly addressing termination, history management, duplication, and user-facing behavior.