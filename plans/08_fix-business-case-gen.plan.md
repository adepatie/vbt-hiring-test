# Restore Copilot Business Case Generation

## 1. Inspect current LLM wiring and likely failure points

- Review `lib/copilot/llmClient.ts` to confirm the request shape (`/chat/completions`, `model`, `messages`, `max_completion_tokens`, `response_format`) and how `content` is extracted from the provider response.
- Trace the business-case flow in `lib/copilot/actions.ts` (`generateBusinessCaseFromArtifacts` → `generateEstimateStageDraft`) and `app/api/copilot/route.ts` to confirm where `CopilotLLMError` is thrown vs. swallowed and what reaches the UI.
- Cross-check context construction in `lib/copilot/context/estimates.ts` and `lib/copilot/prompts/estimates.ts` to ensure we are not accidentally building an empty or malformed prompt.

## 2. Add robust diagnostics around the LLM call

- In `lib/copilot/llmClient.ts`, add optional, guarded logging controlled by `ENABLE_LLM_LOGGING` that records:
- Model, timeout, `max_completion_tokens` (and any env overrides).
- High-level prompt stats: total characters/tokens of the concatenated `messages` payload.
- A compact snapshot of the raw response shape (e.g., top-level keys, `choices[0]`, `output_text`, or `output` fields), without logging full content.
- Clear logs for timeouts (connection-level) and non-2xx HTTP responses.
- In `lib/copilot/actions.ts`, ensure we log when `result.content` is empty before throwing `CopilotLLMError("Copilot did not return any business case content.")`, so we can distinguish upstream empty content from earlier failures.

## 3. Verify provider compatibility and response parsing

- Confirm which provider and endpoint you are actually hitting via env (`OPENAI_BASE_URL`, `OPENAI_MODEL` / `LLM_MODEL`), and whether it expects classic Chat Completions or a Responses-style API.
- If the provider is classic OpenAI Chat Completions:
- Consider sending both `max_completion_tokens` and `max_tokens` in the request body to be maximally compatible.
- Ensure `response_format` is supported for the chosen model; if not, fall back to the default.
- If the provider is a Responses-style API:
- Adjust `callLLM` to hit the appropriate path and request shape (e.g., `responses` with `input` instead of `messages`) while keeping the same `CopilotLLMResult` shape.
- Expand the response parsing in `callLLM` (already handling `choices[0].message.content`, `output_text`, `output[0].content`, and `content`) to also log when we fall back to JSON-stringifying unknown shapes, so we can see if the provider is returning an unexpected structure.

## 4. Revisit token and timeout settings with real metrics

- Use the existing prompt metrics in `lib/copilot/actions.ts` (and the new logging from step 2) to collect actual token/character counts for the seeded project business-case calls.
- Compare these against the model’s documented context window and maximum output tokens:
- If prompts are clearly within safe limits, prioritize increasing `LLM_TIMEOUT_MS` or reducing upstream latency (e.g., fewer nested LLM calls before the business-case call).
- If prompts are near the context limit, further reduce `COPILOT_ARTIFACT_CONTEXT_TOKEN_LIMIT` or summary sizes in `lib/server/artifact-summary.ts` while keeping artifacts semantically rich.
- Align `BUSINESS_CASE_COMPLETION_TOKENS` in `lib/copilot/actions.ts` with `LLM_MAX_OUTPUT_TOKENS` (or make it configurable) so that raising the env limit actually influences the business-case call.

## 5. Create a minimal "LLM ping" Copilot action for sanity checks

- Add a simple Copilot action (e.g., `debugPingLLM`) in `lib/copilot/actions.ts` that calls `generateEstimateStageDraft` with a trivial prompt ("Reply with the word PONG only.") and returns the raw `result.content`.
- Expose this via `app/api/copilot/route.ts` and use it to:
- Confirm that the LLM responds quickly and that `callLLM` parses `content` correctly, independent of artifact context.
- Verify that timeouts and HTTP errors are surfaced as `CopilotLLMError` with the expected `kind` and message.

## 6. Iterate on configuration until business cases are generated

- With diagnostics and the debug action in place, reproduce the business-case flow using the dev seed project and:
- Observe logs for whether the LLM call returns content, times out, or errors.
- Adjust model, timeout, and token limits as needed based on the observed behavior (e.g., slightly reducing completion tokens or context size if the provider enforces stricter limits than documented).
- Once you see consistent, non-empty `draftContent` persisted via `estimatesService.saveStageContent`, remove or downgrade any noisy logging and keep only the concise, high-value diagnostics.

## 7. Final verification and documentation

- Run the existing Copilot tests (`tests/copilotActions.test.ts`, `tests/copilotPrompts.test.ts`) and add any new tests needed for the debug action or updated token behavior.
- Perform an end-to-end manual check:
- Use the dev seed endpoint to create a project.
- Open the project flow UI and regenerate the Business Case.
- Confirm that the textarea is populated with a reasonable draft and that errors are clearly surfaced when the LLM truly fails.
- Update `README.md` (and `AI_ARTIFACTS.md` if necessary) with a short "LLM troubleshooting" section describing the key env vars, logging flags, and the new debug action.