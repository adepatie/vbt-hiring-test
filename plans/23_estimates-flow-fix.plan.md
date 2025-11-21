# Estimates Flow Fix & Prompt Cleanup Plan

### Goals

- Fix blocking or incorrect behaviors in the estimates multi-stage UI.
- Simplify and optimize copilot prompts so requirements/WBS/quote generation is fast and produces consistent, sensible outputs.
- Align seeded data, validations, and UI conditions so stages behave correctly in both seeded and normal flows.
- Ensure artifacts are stored and downloadable.

### 1) Artifacts stage: validation + seeded data

- Locate artifacts stage components in `app/estimates/[projectId]/stage-panels.tsx` (or related components).
- Identify how stage completion is currently validated (likely via `lib/utils/estimates.ts`, `lib/zod/estimates.ts`, or `lib/services/estimatesService.ts`) and what artifact fields are required.
- Inspect the seed data in `prisma/seedData.ts` and/or any artifact-ingest dev helpers in `lib/server/*` to see how artifacts are created for seeded projects.
- Update either:
- the validation logic to treat valid seeded artifacts as satisfying the requirements, and/or
- the seed data so seeded artifacts include all flags/fields that the validator expects (e.g. stage id, status, relevance).
- Add/adjust a test in `tests/estimatesService.test.ts` (or a new test) to cover a seeded project with artifacts that correctly unlocks progression past the artifacts stage.

### 2) Artifacts stage: storage and download after completion

- In the artifacts panel UI (likely `stage-panels.tsx` or related components), identify how artifacts are listed.
- Ensure each artifact record from the backend includes its storage location/URL (via `lib/server/artifact-storage.ts` or equivalent) so a download link can be rendered.
- Add a download button/link per artifact using the stored URL (e.g. `/api/artifacts/[id]/file`) that appears once the artifacts stage is marked complete (or always, if appropriate).
- Verify that the artifact upload/ingest process correctly stores the file and populates the `storedFile` field in the database.
- Add or extend tests (e.g. in `tests/artifactIngest.test.ts`) to verify that artifacts are correctly stored and downloadable.

### 3) Business case page: hide copilot UI after approval

- Find the business case stage UI within `project-flow-view.tsx`, `stage-panels.tsx`, or a dedicated business case component.
- Trace how a business case is marked “approved” (e.g. a status field on the business case entity in `prisma/schema.prisma`, with logic in `lib/services/estimatesService.ts`).
- Update the UI condition so the “Generate with copilot” button and related controls are hidden when the business case is approved.
- Ensure the business case text content is read-only in this specific UI view after approval (preventing manual edits from this screen).
- Add/adjust tests to assert that approved business cases do not expose the copilot generation option in the UI.

### 4) Requirements generation: prompt cleanup & performance

- Locate the requirements prompt template in `lib/copilot/prompts` and see how it is constructed (e.g. combined context from project, artifacts, business case, and existing requirements).
- Audit the prompt for duplicate instructions, repeated context sections, or unnecessary verbosity (e.g. reiterating the full business case multiple times).
- Simplify the instructions while preserving behavior:
- Keep only one concise description of the project and artifacts.
- Trim any redundant examples or long guidance sections.
- Tighten output requirements (e.g. cap number/length of requirements if currently unbounded).
- Check the code path in `lib/copilot/actions.ts` and `lib/copilot/context/estimates.ts` to ensure we’re not passing large, duplicate context objects.
- Re-run or extend `tests/copilotPrompts.test.ts` to cover the new prompt structure and ensure token size is reduced (e.g. via snapshot or length checks).

### 5) Effort page: clean up role select display

- Identify the effort/estimation UI on the effort stage panel in `project-flow-view.tsx` or a dedicated effort component.
- Locate where role options are built (likely using data from `lib/services/rolesConfig.ts` or `estimatesService`) and remove rates from the option labels while preserving the selected role’s rate display below.
- Keep a single, clearly formatted rate display outside of the select (e.g. “$X/hour”) that updates when the role changes.
- Verify any form schemas in `lib/zod/estimates.ts` and utility mappers in `lib/utils/estimates.ts` still align with the UI.

### 6) WBS items: constrain and clarify hours via prompt

- Find the WBS generation prompt in `lib/copilot/prompts` and identify where it describes expected hours/duration per WBS item.
- Update prompt instructions so that:
- Each WBS item’s estimated hours are typically within 2–40 hours.
- Larger efforts must be broken into multiple, smaller WBS items.
- Extremely large, unrealistic hour values should be explicitly discouraged.
- If there is any post-processing step in `lib/utils/estimates.ts` or `lib/services/estimatesService.ts` that normalizes WBS hours, consider adding soft sanity checks or caps (e.g. logging or gently clamping outliers) without silently corrupting valid data.
- Extend or add tests (e.g. in `tests/estimatesService.test.ts` or `tests/copilotPrompts.test.ts`) to assert that typical generated WBS hours fall in a reasonable range.

### 7) Quote page: remove incorrect read-only message

- Locate the quote stage UI in `app/estimates/[projectId]/page.tsx`, `project-flow-view.tsx`, or a quote-specific component.
- Remove the misleading static message “Quote details are read-only until the quote stage is active”.
- Double-check actual editability rules for quote fields (if any) and ensure the UI behavior matches them without relying on that message.

### 8) Quote page: standardize payment terms format

- Find the quote generation prompt template in `lib/copilot/prompts` and any mapping functions that transform quote data for the UI.
- Update the prompt instructions to enforce a milestone-style format for payment terms, such as:
- “40% on signing, 40% on UAT completion, 20% on go-live” (or similar 2–4 milestone breakdowns by percentage and event).
- Require percentages to add to 100% and reference clear project milestones.
- If the UI or schema allows arbitrary payment term text, keep it flexible but clarify via placeholder/description text so manually entered terms also follow the milestone-style pattern.
- Add or update tests (e.g. `tests/copilotPrompts.test.ts`) to assert that generated payment terms adhere to the milestone-style format.

### 9) Validation & regression tests

- Run the existing test suites, especially `tests/estimatesService.test.ts`, `tests/copilotPrompts.test.ts`, and relevant integration tests in `tests/integration`.
- Add or adjust focused tests around each changed area: artifacts completion, business case copilot visibility, requirements/WBS/quote prompt behavior, and quote payment terms format.
- Validate the full UI flow manually (or via existing integration tests) from project selection through quote to ensure stages unlock and render as expected.