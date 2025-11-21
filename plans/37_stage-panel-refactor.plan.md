<!-- e2f34fc2-2614-4aa9-a27c-350b3a4b6c75 2c8ede93-b5d9-430d-a7c2-4f36bb4e240f -->
# Refactor `stage-panels` module

## Goals

- Reduce complexity and size of `app/estimates/[projectId]/stage-panels.tsx` by splitting into cohesive modules.
- Remove redundant/unreachable code and any unused helpers.
- Improve consistency around the Action Bar, Copilot calls, and stage progression logic.
- Preserve existing UX and behavior while making the system easier to evolve.

## Findings from audit

- **Single huge module**: `stage-panels.tsx` (~1900 lines) owns:
- Stage metadata (`stageMeta`, `stageBadgeClass`, `NarrativeRecord`, form schemas & helpers).
- Navigation UI (`StageNavigator`, `StageSidebar`).
- Layout helpers (`StageSummaryCard`, `StageTimeline`, `SummaryPanel`).
- All stage-specific panels (`ArtifactsPanel`, `NarrativeStageForm`, `WbsEditor`, `QuoteForm`).
- Orchestration (`StageContentPanel`).
- **Redundant / unused pieces**:
- `quoteTotalSchema` is defined but unused anywhere in the file.
- `StageSummaryCard` computes `nextStage` but never uses it.
- `stageMeta.type` supports a `"summary"` variant and `StageContentPanel` has a `summary` branch, but no `EstimateStage` uses that type (per `lib/zod/estimates.ts`), so that path is currently unreachable.
- **Action Bar duplication**:
- Multiple components (`SummaryPanel`, `ArtifactsPanel`, `NarrativeStageForm`, `WbsEditor`, `QuoteForm`) each manage `useActionBar` directly and manually clear actions on unmount via `useEffect` cleanup.
- Each defines slightly different effects/cleanup, increasing surface for subtle bugs.
- **Copilot / server interaction duplication**:
- Several components make raw `fetch("/api/copilot")` calls with similar payload shapes (e.g., `generateBusinessCaseFromArtifacts`, `generateRequirementsFromBusinessCase`, `generateSolutionArchitectureFromRequirements`, `generateEffortFromSolution`, `generateQuoteTerms`).
- WBS and Quote panels also have overlapping logic for building WBS summaries for Copilot.
- **Potential best-practices issues**:
- In `WbsEditor`, `useTransition` is imported and `isPending` is read but `startTransition` is never called, so `isPending` is always `false` and provides no real state; this is misleading and can be simplified or wired correctly.
- Debounced auto-save logic is correct but dense; extracting to a focused helper/hook would improve readability.
- Several utilities (`formatFileSize`, `normalizeWbsItems`, `allowedArtifactExtensions`) are UI-agnostic and could live in a shared estimates util module.

## Proposed module breakdown

### 1. Stage configuration & shared types

- **New file**: `app/estimates/[projectId]/stage-config.ts`
- Export `stageMeta` (or `stageDefinitions`) and `stageBadgeClass`.
- Export `NarrativeRecord` type and any other stage-level types that are needed across components.
- Keep this file purely declarative (no React hooks), so it can also be reused in non-React contexts if needed.
- **Adjustments**:
- Update `project-flow-view.tsx`, `StageSummaryCard`, `StageNavigator`, `StageSidebar`, etc., to import `stageBadgeClass`, `stageMeta` (or `stageDefinitions`) and `EstimateStage`/`estimateStageOrder` from this file or directly from `lib/zod/estimates` as appropriate.
- Decide whether to keep the unused `"summary"` type; if not needed, tighten the type union and remove the dead `summary` branch in `StageContentPanel`.

### 2. Navigation & timeline components

- **New file**: `app/estimates/[projectId]/StageNavigation.tsx`
- Move `StageNavigator` and `StageSidebar` here.
- Keep them focused on visual navigation and stage selection; no business logic.
- **New file**: `app/estimates/[projectId]/StageTimeline.tsx`
- Move `StageTimeline` here (plus `dateTimeFormat` for transitions if desired or share via a small `dates.ts` util).
- **Public API**: Re-export the above from an `index.ts` or a small barrel file if convenient, so `project-flow-view.tsx` has stable imports.

### 3. Summary and high-level context

- **New file**: `app/estimates/[projectId]/StageSummary.tsx`
- Move `StageSummaryCard` and `SummaryPanel` here.
- Ensure `SummaryPanel` remains responsible only for rendering delivered-quote summary and clearing the Action Bar when it’s active.
- Remove unused `nextStage` computation in `StageSummaryCard` or wire it into the UI if you intend to display next-step info.

### 4. Stage content orchestration

- **New file**: `app/estimates/[projectId]/StageContentPanel.tsx`
- Keep a slim `StageContentPanel` that:
  - Chooses the correct stage-specific panel based on `selectedStage` and `stageMeta.type`.
  - Computes `narrativeRecord` for narrative stages.
- Import and render individual stage components (`ArtifactsPanel`, `NarrativeStageForm`, `WbsEditor`, `QuoteForm`, `SummaryPanel`).
- Optionally centralize shared props (e.g., `canEdit`, `nextStage`) and pass them consistently.

### 5. Stage-specific panels

- **New folder**: `app/estimates/[projectId]/stages/`

- **Artifacts**
  - File: `stages/ArtifactsPanel.tsx`.
  - Contains `ArtifactsPanel`, `artifactFormSchema`, `allowedArtifactExtensions`, and `formatFileSize`.
  - Responsibilities:
  - Rendering existing artifacts and upload form.
  - Validating new artifact inputs.
  - Handling upload/delete via existing `/api/projects/.../artifacts` and `removeArtifactAction`.
  - Managing stage advancement from ARTIFACTS to the next stage.
  - Cleanups:
  - Keep `useActionBar` handling here but consider using a shared Action Bar helper (see section 6).

- **Narrative stages (Business Case, Requirements, Solution)**
  - File: `stages/NarrativeStageForm.tsx`.
  - Contains `NarrativeStageForm`, `narrativeFormSchema`, and `NarrativeRecord` consumption.
  - Responsibilities:
  - Editing/saving/approving narrative content for a given `EstimateStage`.
  - Handling Copilot regeneration (`generateBusinessCaseFromArtifacts`, `generateRequirementsFromBusinessCase`, `generateSolutionArchitectureFromRequirements`).
  - Managing stage advancement on approval.
  - Cleanups:
  - Optionally move `regenerateConfig` logic into a small mapping helper (stage → action/labels) to keep the component lean.

- **Effort / WBS**
  - File: `stages/WbsEditor.tsx`.
  - Contains `WbsEditor`, `wbsFormSchema`, `normalizeWbsItems` and related helpers.
  - Responsibilities:
  - Editing WBS rows, auto-saving via debounced calls to `updateWbsItemsAction`.
  - Calling Copilot to regenerate WBS (`generateEffortFromSolution`).
  - Generating quote terms and advancing to QUOTE (`handleGenerateQuoteAndAdvance`).
  - Cleanups & best practices:
  - Fix or remove the `useTransition` usage: either wrap heavy async flows in `startTransition` or replace `isPending` with explicit `isSaving`/`isWorking` flags.
  - Consider extracting the debounced auto-save logic into a small custom hook (e.g., `useDebouncedAutosave`) to make the core component easier to read.
  - Share WBS summary-building logic with Quote (see below) via a pure helper.

- **Quote**
  - File: `stages/QuoteForm.tsx`.
  - Contains `QuoteForm` and `quoteFormSchema`.
  - Responsibilities:
  - Displaying pricing breakdown per role and totals.
  - Managing quote form (payment terms, timeline, delivered flag) and persisting via `saveQuoteAction`.
  - Regenerating terms with Copilot and exporting/copying quote text.
  - Cleanups:
  - Use a shared helper to build WBS summary strings for Copilot instead of hardcoding in-place.
  - Ensure overhead fee and totals are consistently derived from server rules (they already are, but we can clarify this in comments and types).

### 6. Action Bar helper / hook

- **New file**: `app/estimates/[projectId]/useStageActionBar.tsx` (or similar name).
- Expose a small hook like `useStageActions(renderActions, deps)` that:
  - Accepts a render function or ReactNode for the current stage’s actions.
  - Sets `setActions` on mount or when deps change.
  - Automatically clears actions on unmount.
- Update `SummaryPanel`, `ArtifactsPanel`, `NarrativeStageForm`, `WbsEditor`, and `QuoteForm` to use this helper instead of duplicating `useEffect`/cleanup logic.
- **Benefit**: Single, consistent source for Action Bar lifecycle; easier to adjust in the future.

### 7. Copilot and WBS summary helpers

- **New file**: `app/estimates/[projectId]/copilotHelpers.ts` or reuse `lib/copilot` abstractions if they already exist for these actions.
- Introduce typed helper functions for the repeated Copilot POST calls:
  - `callCopilot(action, workflow, entityId, payload)` or more specific wrappers like `regenerateNarrativeStage`, `regenerateWbsFromSolution`, `generateQuoteTermsFromWbs`.
- Move WBS summary-building logic into shared pure functions, e.g.:
  - `buildWbsSummaryFromRoleOptions(items, roles)` (for WBS editor context).
  - `buildWbsSummaryFromItems(wbsItems)` (for quote context where `roleName`/`roleRate` already exist on items).
- Update `NarrativeStageForm`, `WbsEditor`, and `QuoteForm` to use these helpers, reducing duplication and centralizing error handling.

### 8. Utilities and dead code cleanup

- **Shared utilities**:
- Consider moving generic helpers such as `formatFileSize` to `lib/utils/estimates.ts` if they are (or will be) used elsewhere, or keep them local in `ArtifactsPanel` if they’re strictly UI concerns.
- Keep `normalizeWbsItems` close to `WbsEditor` unless used on the server; if useful server-side, consider a shared util under `lib/utils/estimates.ts`.
- **Dead / unused code**:
- Remove `quoteTotalSchema` since it is currently unused.
- Remove the unused `summary` branch and/or tighten `stageMeta` types if there is no planned Summary stage.
- Remove unused computed values like `nextStage` inside `StageSummaryCard` if not used.

### 9. Wiring and behavior verification

- **Update imports and exports**:
- Update `project-flow-view.tsx` to import from the new files (navigation, summary, content panel, etc.).
- Provide a small barrel file (e.g., `app/estimates/[projectId]/stages/index.ts`) if it simplifies imports.
- **Behavior parity checks** (after refactor):
- Verify navigation works in both mobile (`StageNavigator`) and desktop (`StageSidebar`) layouts.
- Confirm stage editing locks/unlocks correctly when switching stages and that Action Bar actions appear/disappear as before.
- Ensure Copilot interactions (all regenerate/generate flows) still function and handle errors as currently.
- Confirm WBS auto-save behavior and quote generation + advancement flow still work as expected.

### To-dos

- [ ] Extract stage configuration and shared types from stage-panels.tsx into a dedicated stage-config module and update imports.
- [ ] Move navigation (StageNavigator, StageSidebar) and summary/timeline components into their own files and wire them into project-flow-view.tsx.
- [ ] Create a dedicated StageContentPanel module and move stage-specific panels (ArtifactsPanel, NarrativeStageForm, WbsEditor, QuoteForm) into a stages subfolder.
- [ ] Introduce a small Action Bar helper hook and update all stage panels to use it instead of custom useEffect cleanup logic.
- [ ] Extract Copilot and WBS summary helpers into reusable functions and update panels to use them, removing duplicated logic.
- [ ] Remove unused schemas and unreachable branches (e.g., quoteTotalSchema, unused summary type/branch) and fix minor best-practices issues like unused useTransition in WbsEditor.