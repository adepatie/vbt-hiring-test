# LLM Service Design for Artifacts & Copilot

## Goal

Design a reusable, server-side LLM service that uses GPT-5.1 mini to interpret uploaded artifacts and generate business case drafts for the Estimates workflow, while also serving as the shared Copilot foundation for other workflows (WBS adjustments, contracts drafting, policy reviews).

## 1. LLM Client & Configuration

- Define environment-driven configuration for the LLM provider and model (e.g. GPT-5.1 mini) with clear defaults and per-use overrides.
- Implement `lib/copilot/llmClient.ts` that wraps the provider SDK, exposing a small set of typed functions:
- `callLLM({ systemPrompt, messages, tools, toolChoice, maxTokens })` low-level primitive.
- Higher-level helpers such as `generateEstimateStageDraft(context)` and `summarizeDocument(context)` as thin wrappers around `callLLM`.
- Handle timeouts, retries, basic logging, and structured error types so that downstream actions can differentiate transient vs validation errors.

## 2. Prompt Library & Spec Integration

- Create a prompt library module (e.g. `lib/copilot/prompts/estimates.ts` and `lib/copilot/prompts/contracts.ts`) that centralizes system prompts and reusable prompt fragments.
- Encode key product behavior and workflow rules from `spec/ARCHITECTURE.md` (and the requirements PDF, conceptually) into concise system prompts:
- Explanation of the 6-stage Estimates workflow, with emphasis on the Artifacts and Business Case stages.
- Guidelines for tone, structure, and level of detail in business case outputs.
- Provide helper functions like `buildBusinessCasePrompt({ project, artifactsSummary, priorStages })` to keep prompt construction testable and versionable.

## 3. Artifact Ingestion & Interpretation

- Design an artifact ingestion interface (e.g. `buildArtifactsContext(projectId)` in a `lib/copilot/estimates/artifactsContext.ts` module) that:
- Pulls artifact metadata and file references from existing artifact storage (API/routes + `lib/server/artifact-storage.ts`).
- Extracts or normalizes artifact contents into plain text (PDF/DOCX, etc.) via pluggable extractors.
- Produces a compact, token-efficient summary representation suitable for passing to the LLM.
- Introduce a small normalization layer to:
- Deduplicate overlapping artifact content.
- Truncate or prioritize sections based on relevance (e.g. scope, constraints) before sending to the LLM.

## 4. Context Model & Builders

- Reuse and refine the Copilot context model from the architecture spec:
- `workflow`: "estimates" or "contracts".
- `entityId`: `projectId` or `agreementId`.
- `view`: e.g. `"stage"`, `"wbs"`, `"agreement_version"`.
- `dataSnapshot`: minimal set of domain data needed per use case.
- Implement dedicated context builder functions in `lib/copilot/context/` (e.g. `buildEstimateStageContext(projectId, stageType)`):
- Fetch `Project`, `EstimateStage`, `StageTransition`, and `WbsItem` data from services.
- Attach artifacts summary for the Artifacts and Business Case stages.
- Ensure these builders are decoupled from any particular UI so they can be reused both by chat-based Copilot and one-shot server actions.

## 5. Copilot Action Registry Extensions

- Extend `lib/copilot/actions.ts` with new actions focused on artifact interpretation and business case generation:
- `generateBusinessCaseFromArtifacts({ projectId })`.
- `summarizeArtifacts({ projectId })` for exploratory use.
- Each action should:
- Validate inputs using Zod schemas in `lib/zod/estimates.ts` (or new schemas if needed).
- Use context builders to assemble the LLM context and prompt via the prompt library.
- Call `llmClient` and convert the LLM output into domain updates (e.g. set `EstimateStage.contentDraft` for `BUSINESS_CASE`).
- Return a structured result including updated entities and a short natural-language summary for the UI.

## 6. Copilot Entry Point & API Shape

- Implement or refine a Copilot entrypoint (e.g. `app/api/copilot/route.ts` or a server action) that:
- Receives user message + `workflow`, `entityId`, `view`, and optional flags like `intent` (e.g. `"generate_business_case"`).
- Maps intents/tool calls from the LLM to actions in the registry.
- Streams or returns:
- Chat messages for the Copilot panel.
- Data updates (e.g. new stage draft) and UI hints (e.g. "show Business Case stage").
- Keep the transport layer generic so the same API can support both chat-driven Copilot interactions and direct button-triggered flows (e.g. "Generate draft with Copilot" on a stage panel).

## 7. Integration with Estimates Workflow UI

- Wire the new `generateBusinessCaseFromArtifacts` action into the Estimates project detail UI:
- Add a "Generate Business Case draft with Copilot" control on the Business Case stage panel.
- On click, call the Copilot entrypoint with the appropriate intent and context, then store the resulting draft as `contentDraft`.
- Ensure the existing stage approval and transition logic remains the source of truth for marking the Business Case stage as approved and advancing the project.
- Optionally, surface artifacts summaries in the UI so users can see what the LLM is "seeing" when generating the business case.

## 8. Reuse for Other Copilot Use Cases

- Generalize the LLM client, context builders, and action registry so they can be reused for:
- WBS adjustments (Effort Estimate stage) by mapping natural language instructions to updates on `WbsItem`s.
- Contracts Copilot actions like drafting agreements from an estimate and reviewing agreements against `PolicyRule`s.
- Keep domain-specific logic in their own modules (e.g. `/estimates` vs `/contracts`) while sharing the core LLM plumbing and entrypoint.

## 9. Observability, Guardrails, and Testing

- Add structured logging around LLM calls (inputs metadata, token counts, latency, truncated summaries) while avoiding storage of full sensitive content.
- Implement basic guardrails in prompts (e.g. stay within context, follow workflow rules) and enforce output shapes via lightweight parsing/validation.
- Add unit tests for:
- Prompt builders and context builders (ensuring they include the right fields).
- Action functions to verify they correctly update domain objects given mocked LLM outputs.
- Document the LLM service behavior, configuration, and limitations in `AI_ARTIFACTS.md` and/or a dedicated Copilot README for future contributors.