## Implement Estimates Feature Set (Non-LLM Phase)

### Goals

- **Deliver a usable, non-LLM Estimates workflow** covering projects list, project detail with stages, WBS, and stage transitions.
- **Align with existing architecture** (`ARCHITECTURE.md`, Prisma models, `estimatesService`, Zod schemas) and keep LLM/Copilot hooks out of this phase.

### 1. Data & Types Layer

- **Confirm Prisma schema alignment**
- Use the existing `Project`, `Artifact`, `BusinessCase`, `Requirements`, `SolutionArchitecture`, `WBSItem`, `Quote`, and `StageTransition` models in `prisma/schema.prisma` as the single source of truth.
- Map `EstimateStage` enum to UI stages (ARTIFACTS, BUSINESS_CASE, REQUIREMENTS, SOLUTION, EFFORT, QUOTE, DELIVERED) and keep its usage consistent across services and UI.
- **Extend Zod schemas for Estimates**
- In `lib/zod/estimates.ts`, expand beyond `projectStubSchema` to include:
- `projectSchema` with full fields (id, name, optional clientName if introduced, stage, timestamps).
- Input schemas for creating/updating a project (e.g. `createProjectInput`, `updateProjectStageInput`).
- Schemas for each stage content (business case, requirements, solution, quote) and WBS operations.
- Schema for `StageTransition` records (for timeline display).

### 2. Domain Service: `estimatesService`

- **Implement project queries** in `lib/services/estimatesService.ts`:
- `listProjects()` -> return list of projects ordered by `updatedAt`, mapped to `ProjectStub`/`projectSchema`.
- `getProjectWithDetails(projectId)` -> return project plus related entities (business case, requirements, solution, WBS items, quote, transitions, artifacts count).
- **Implement mutation methods (no LLM logic)**:
- `createProject(data)` -> create a new `Project` at `ARTIFACTS` stage.
- `updateProjectMetadata(projectId, data)` -> rename project, set client name if supported.
- `saveStageContent(projectId, stage, content)` -> upsert the appropriate content model (BusinessCase, Requirements, SolutionArchitecture, Quote); mark `approved` only when explicitly requested.
- `updateWbsItems(projectId, items)` -> replace or upsert `WBSItem` rows based on a simple list (no tree hierarchy yet, consistent with schema).
- `addStageTransition(projectId, from, to)` and `advanceStage(projectId, to)`:
- Validate allowed transitions (enforce strictly ordered flow: ARTIFACTS → BUSINESS_CASE → REQUIREMENTS → SOLUTION → EFFORT → QUOTE → DELIVERED).
- Record `StageTransition` and update `Project.stage` within a transaction.
- **Validation & error handling**
- Use Zod schemas at the service boundary for inputs and outputs.
- Normalize and throw typed errors (e.g. invalid transition, missing project) for the UI to handle.

### 3. Server Actions / Route Handlers

- **Create server actions for Estimates operations** (co-located near UI or in a shared `app/estimates/actions.ts`):
- `createProjectAction(formData)` -> uses `createProject` and returns a redirect to `/estimates/[projectId]`.
- `updateProjectMetadataAction(projectId, data)`.
- `saveStageContentAction(projectId, stage, content)`.
- `updateWbsItemsAction(projectId, items)`.
- `advanceStageAction(projectId, to)` -> uses `advanceStage` and `addStageTransition`.
- **Ensure server-only usage**
- Mark actions with `"use server"` and import them into client components for form submission.
- Keep all DB access within `estimatesService` to preserve layering.

### 4. Estimates List Page (`/estimates`)

- **Replace placeholder UI in `app/estimates/page.tsx`** with a functional list:
- Convert to a React Server Component that calls `estimatesService.listProjects()`.
- Render a Chakra-based layout:
- Table or card list of projects with columns: name, (optional) client name, current stage (badge), `updatedAt`.
- Simple filters (client-side) for stage and (optionally) status.
- Add a "New Project" button opening a minimal form (modal or inline) using `react-hook-form` + Chakra inputs, calling `createProjectAction`.
- **Navigation**
- Each row/title should link to `/estimates/[projectId]`.

### 5. Estimate Detail Page (`/estimates/[projectId]`)

- **Data loading**
- Update `app/estimates/[projectId]/page.tsx` to be a server component that calls `estimatesService.getProjectWithDetails(projectId)`.
- Pass data into child client components for interactive editing.
- **Stage stepper UI**
- Implement a Chakra-based stepper along the top showing all stages from `EstimateStage`.
- Highlight the current stage; disable navigation to future stages for now (or allow read-only view for past stages only).
- **Stage panel**
- For each stage (except ARTIFACTS & EFFORT/WBS initially), show:
- Entry criteria description (static text from `ARCHITECTURE.md`/requirements distilled into short descriptions).
- A textarea or simple editor managed with `react-hook-form`, prefilled with existing content.
- Buttons: "Save draft" (calls `saveStageContentAction`), "Approve & advance" (validates required content, calls `saveStageContentAction` and `advanceStageAction`).
- For **Artifacts**:
- Provide a minimal list view of `Artifact` items (text + optional URL) and a simple form to add new artifacts.
- For **Quote**:
- Show fields for payment terms, timeline, and calculated total.

### 6. WBS Editor (Effort Stage)

- **Basic table UI**
- In the Effort/WBS section of the detail page, render a Chakra `Table` of `WBSItem`s with columns: task, role, hours.
- Allow adding/removing rows and editing values inline using `react-hook-form`'s `useFieldArray`.
- **Totals and validation**
- Display total hours and (optionally) totals per role, computed client-side from the form state.
- Enforce basic validation rules: `hours > 0`, non-empty task and role.
- **Persistence**
- On save, call `updateWbsItemsAction` with the full list, using Zod validation before sending to the service.

### 7. Stage Transitions Timeline

- **Timeline UI**
- Use a vertical `Stack` or `Timeline`-style layout on the detail page to show `StageTransition` history.
- Each item shows: `from → to`, timestamp, and optional note.
- **Integration with actions**
- Ensure `advanceStageAction` appends to this list so it updates after a refresh or client-side revalidation.

### 8. UX Polish & Error Handling

- **Loading & empty states**
- Add loading placeholders where appropriate (e.g. skeletons or spinners) for list and detail pages.
- Provide clear empty states for no projects, no WBS items, no transitions.
- **Form feedback**
- Surface Zod validation errors from server actions into the forms using `react-hook-form` error APIs.
- Show toast notifications (Chakra `useToast`) for success/failure of actions.
- **Non-LLM guardrails**
- Ensure all "Generate draft with Copilot" buttons and Copilot UI are omitted or stubbed out in this phase.

### 9. Testing & Documentation

- **Tests**
- Add unit tests (or minimal integration tests) for `estimatesService`:
- Stage transition validation and ordering.
- WBS items CRUD and total-hours calculation helpers (if factored out).
- Optionally add a basic e2e or integration test for creating a project, editing a stage, and advancing stages.
- **Docs**
- Update `README.md` or `APPROACH.md` with a short section describing the Estimates workflow:
- How to run migrations and start the app.
- How to create a project and walk through stages without Copilot.

### 10. Future Phase Hooks (LLM, but not implemented now)

- **Keep extension points ready**
- Design `estimatesService` methods and server actions such that future Copilot actions can call them without major refactors.
- Leave TODO comments or clear placeholders where LLM-generated drafts will be injected later (e.g. in stage content and WBS adjustment flows), but do not include any LLM calls in this phase.