# Make Business Case Generation Reliable on Artifacts Approval

## 1. Reconfirm current behavior and entry points

- Review `app/estimates/[projectId]/stage-panels.tsx` to verify how `ArtifactsPanel.handleAdvance` triggers `advanceStageAction` and (currently) calls `/api/copilot`.
- Confirm how both the Flow view (`app/estimates/[projectId]/flow/page.tsx` + `project-flow-view.tsx`) and the main detail view (`project-detail-view.tsx`) invoke stage advancement and whether they share the same `advanceStageAction`.

## 2. Move business case generation to the server action layer

- Update `app/estimates/actions.ts` so `advanceStageAction` is responsible for triggering Copilot when advancing from `ARTIFACTS` → `BUSINESS_CASE`:
- After calling `estimatesService.advanceStage`, detect this specific transition.
- Call `copilotActions.generateBusinessCaseFromArtifacts({ projectId })` directly (not via HTTP), letting it persist the draft via `saveStageContent`.
- On Copilot errors, throw a descriptive error so the client shows a clear toast.
- Keep `revalidateProject` behavior so both `/estimates/[projectId]` and `/estimates/[projectId]/flow` reflect the updated stage and draft content.

## 3. Simplify the client-side Artifacts advance flow

- In `ArtifactsPanel.handleAdvance` (in `stage-panels.tsx`):
- Remove the explicit `fetch("/api/copilot")` call and rely solely on `advanceStageAction` to handle both the stage transition and business case generation.
- Continue to use `isAdvancing` to display the loading spinner and "Working..." label while the server action (including the LLM call) is in flight.
- On success, show a toast indicating that the stage advanced and the Business Case draft was generated; on failure, show whatever message `advanceStageAction` surfaced.

## 4. Ensure navigation lands on the Business Case stage

- Confirm that `ProjectFlowView` in `project-flow-view.tsx` still:
- Uses `project.stage` as the initial `selectedStage`.
- Updates `selectedStage` when `project.stage` changes after `router.refresh()`.
- If needed, in the main detail view (`project-detail-view.tsx`), ensure that after a successful `advanceStageAction` from Artifacts the UI either:
- Refreshes and lets the existing `StageNavigator`/`StageContentPanel` show the Business Case stage, or
- Explicitly navigates to the Flow view (`/estimates/[projectId]/flow`) for the full Copilot-driven experience.

## 5. Verify behavior and add regression coverage

- Manually exercise the flow using the dev seed project:
- Advance from Artifacts to Business Case and confirm:
  - The button shows a loading state while the server action + LLM run.
  - On completion, the app shows the Business Case stage and the textarea is populated when the LLM succeeds.
  - If Copilot fails, an error toast appears and no draft is saved.
- Optionally extend existing Vitest coverage by stubbing `copilotActions.generateBusinessCaseFromArtifacts` in a new test for `advanceStageAction` (or a small wrapper) to assert that the LLM is invoked only on the `ARTIFACTS` → `BUSINESS_CASE` transition.