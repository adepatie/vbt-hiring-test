# Plan: Friendly Tool Messaging & Stage Access

## Objectives
1. **Conversation UX**: Ensure every tool invocation is represented as a concise, friendly chat bubble instead of raw JSON.
2. **Tool Logging**: Keep detailed tool execution data for debugging, but surface only user-friendly summaries in the UI.
3. **Estimate Editing Rules**: Allow Copilot to mutate any estimate stage up to (and including) the project’s current stage; only block future stages.

## Implementation Steps

### 1. UI Cleanup (`components/copilot/chat-message.tsx`)
- Replace the tool-output block with a lightweight bubble such as “Tool ▸ estimates.getProjectDetails — success”.
- Remove the default raw JSON dump; optionally keep a small “Show details” toggle for debugging, but default closed.
- Ensure the layout matches standard assistant bubbles (padding, colors).

### 2. Copilot State Layer (`lib/copilot/hooks.ts`, `components/copilot/copilot-context.tsx`)
- When adding tool messages to state, attach metadata (tool label, status, optional summary text produced by `summarizeToolExecutions`).
- Map that metadata to the friendly bubble rendered above.

### 3. Backend Formatting (`lib/copilot/helpers.ts`)
- Extend `executeToolCalls` to return a short `statusText` per tool (e.g., “Looked up project details”, “Added 3 WBS items”). Use existing `summarizeToolExecutions` helpers where possible.
- Keep `executionSummaries` for final assistant turns; UI should rely on the new concise strings.

### 4. Stage Access Logic (`lib/services/estimatesService.ts` or new helper)
- Use `estimateStageOrder` to implement `canEditStage(currentStage, targetStage)`.
- In Copilot mutation paths