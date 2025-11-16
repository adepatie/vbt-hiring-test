## Multi-Workflow System Architecture (Estimates + Contracts + Copilot)

### 1. Purpose and Constraints

- **Goal**: Internal web app for a consulting company to:
  - Produce client project estimates via a structured, 6‑stage workflow.
  - Create, review, and version contracts (MSA/SOW) linked to those estimates.
  - Provide a unified, context‑aware Copilot assistant that can automate and orchestrate workflow steps using natural language.
- **Constraints**:
  - **Timeline**: 1‑week hiring test, iterative and minimalistic.
  - **Scope**: Focus on thin end‑to‑end slices of both workflows, starting with Estimates.
  - **Users**: Single internal user, **no authentication** for the demo.
  - **Deployment**: Local‑only; not optimized for scale.
  - **Persistence**: Postgres via Prisma; local file storage allowed for any needed artifacts (no in‑repo storage).
  - **Copilot**: Core feature; must be able to read/write workflow data and trigger server actions.

### 2. Tech Stack

- **Frontend**
  - **Framework**: Next.js (App Router) + React.
  - **UI**: Chakra UI.
  - **Forms**: `react-hook-form` with Zod for validation.
  - **State/Data**: React server components + client components; server actions for mutations.

- **Backend**
  - **Runtime**: Next.js server environment (Node/Edge as appropriate).
  - **Validation**: Zod schemas shared between client and server.
  - **ORM**: Prisma.
  - **Database**: Postgres (single instance).
  - **Storage**: Local filesystem for any temporary or generated documents.

- **AI / Copilot**
  - **LLM**: GPT‑5.1 family (via OpenAI‑style APIs).
  - **Pattern**: All LLM interaction is server‑side via dedicated Copilot modules.
  - **Safety**: LLM can only call whitelisted server actions; no direct DB access.

### 3. High-Level Application Structure

#### 3.1 Directory Layout (Conceptual)

- `app/`
  - `layout.tsx`, `page.tsx`: global shell + dashboard.
  - `estimates/`: Estimates workflow UI + server actions.
  - `contracts/`: Contracts workflow UI + server actions.
  - `copilot/` or `api/copilot/`: Copilot entrypoint (chat + tool execution).
- `lib/`
  - `db.ts`: Prisma client singleton.
  - `zod/`: shared Zod schemas for Estimates, Contracts, Copilot.
  - `services/`: domain services (e.g. `estimatesService`, `contractsService`).
  - `copilot/`: LLM client, context builder, action registry, and orchestration.
  - `utils/`: cross‑cutting helpers (error handling, formatting, etc.).
- `prisma/`
  - `schema.prisma`: database model definitions.
- `requirements/`
  - PDF spec + sample MSA documents (source of truth for product behavior).
- `spec/`
  - `ARCHITECTURE.md`: this architecture document.
- Root docs:
  - `README.md`, `AI_ARTIFACTS.md`, `APPROACH.md`, `TESTING.md`.

> Note: The exact file naming may evolve, but the separation of concerns (app routes, domain services, shared schemas, copilot orchestration) should remain stable.

#### 3.2 Logical Layers

- **Presentation layer (Next.js app)**
  - Dashboard, lists, detail views, stepper UIs, review screens.
  - Chakra UI components and `react-hook-form`‑based forms.

- **Application layer (Server actions + services)**
  - Encodes workflow rules: stage entry criteria, transitions, validations, versioning.
  - Provides actions the Copilot can call (e.g. “generate stage draft”, “apply proposals”).

- **Domain layer (Prisma + domain services)**
  - Prisma models for Estimates, Contracts, Policies, WBS, history.
  - Domain services with clear per‑aggregate responsibilities (Project, Agreement, etc.).

- **Copilot layer**
  - LLM client + tool schema.
  - Context builders for Estimates and Contracts.
  - Action registry that maps safe, typed actions to underlying services.

### 4. Domain Models (Conceptual)

#### 4.1 Common Concepts

- **Audit / History**
  - Separate history tables (e.g. `StageTransition`, `AgreementVersion`) to track workflow evolution.
  - Timestamps for creation, updates, approvals, and transitions.

#### 4.2 Estimates Domain

**Goal**: Support a strictly ordered 6‑stage estimate workflow:
1. Artifacts  
2. Business Case  
3. Requirements  
4. Solution / Architecture  
5. Effort Estimate (WBS)  
6. Quote  

Each stage requires entry criteria, an LLM draft, human editing, and explicit approval with transition history.

**Core entities (Prisma‑level concepts):**

- **Project**
  - `id`
  - `name`
  - `clientName`
  - `status` (e.g. `IN_PROGRESS`, `COMPLETED`, `ARCHIVED`)
  - `currentStage` (enum: `ARTIFACTS`, `BUSINESS_CASE`, `REQUIREMENTS`, `SOLUTION`, `EFFORT_ESTIMATE`, `QUOTE`)
  - `createdAt`, `updatedAt`

- **EstimateStage**
  - `id`
  - `projectId`
  - `stageType` (same enum as `currentStage`)
  - `contentDraft` (LLM‑generated text)
  - `contentFinal` (approved human‑edited text)
  - `isApproved`
  - `approvedAt`
  - `entryCriteriaMetAt` (optional; when the stage is formally “ready”)

- **StageTransition**
  - `id`
  - `projectId`
  - `fromStage`
  - `toStage`
  - `occurredAt`
  - `note` (optional rationale or summary)

- **WbsItem**
  - `id`
  - `projectId`
  - `name`
  - `role`
  - `hours`
  - `parentId` (nullable for hierarchy)
  - `position` (ordering within siblings)

The WBS structure is intentionally simple (id, parentId, role, hours) to keep the initial implementation lean while still allowing tree‑like breakdowns.

#### 4.3 Contracts Domain

**Goal**: Support policy‑driven contract drafting, review, and versioning, linked to estimates.

**Core entities:**

- **PolicyRule**
  - `id`
  - `name`
  - `description`
  - `ruleType` (simple classification for grouping, e.g. `SECURITY`, `LEGAL`, `DELIVERY`)
  - `isActive`
  - `exampleViolationText` (optional; helps prompt the LLM)

- **Agreement**
  - `id`
  - `title`
  - `clientName`
  - `type` (e.g. `MSA`, `SOW`)
  - `linkedEstimateId` (optional FK to `Project`)
  - `currentVersionId` (FK to `AgreementVersion` for quick lookups)

- **AgreementVersion**
  - `id`
  - `agreementId`
  - `versionNumber` (monotonic integer)
  - `content` (plain text contract body)
  - `notes` (human annotations)
  - `createdAt`

- **Proposal**
  - `id`
  - `agreementVersionId`
  - `source` (`LLM` or `HUMAN`)
  - `beforeText`
  - `afterText`
  - `rationale`
  - `status` (`PENDING`, `APPLIED`, `REJECTED`)

- **AgreementEstimateLink**
  - `id`
  - `agreementId`
  - `estimateProjectId`
  - `alignmentStatus` (e.g. `PENDING`, `OK`, `MISMATCH`)
  - `alignmentNotes`

The **document format** in this phase is plain text only. Exporting to PDF/DOCX and richer formatting is explicitly treated as a stretch goal.

### 5. Copilot Architecture

#### 5.1 LLM Client

- Single LLM client module (e.g. `lib/copilot/llmClient.ts`) wraps GPT‑5.1.
- Exposes high‑level functions:
  - `generateEstimateStageDraft(context)`
  - `adjustWbs(context)`
  - `draftAgreementFromEstimate(context)`
  - `reviewClientDraftAgainstPolicies(context)`
  - `summarizeDocument(context)`
- Handles:
  - Prompt construction (pulling from the PDF spec and sample MSAs where needed).
  - Model selection and parameters.
  - Error handling, timeouts, and basic logging.

#### 5.2 Context Model

The Copilot always operates with explicit context:

- `workflow`: `"estimates"` or `"contracts"`.
- `entityId`: `projectId` (for estimates) or `agreementId` (for contracts).
- `view`: a lightweight hint about what the user is looking at:
  - e.g. `"stage"`, `"wbs"`, `"agreement_version"`, `"review"`.
- `dataSnapshot`: minimal set of relevant fields:
  - For estimates: current stage type, draft/final content, WBS items, transition history.
  - For contracts: current agreement version text, policies, proposals, and linked estimate summary.

The UI passes this context to Copilot along with the user’s natural language request.

#### 5.3 Action Registry

- A central registry (e.g. `lib/copilot/actions.ts`) exposes a map of **action names** to **implementation functions**:
  - Examples:
    - `generateStageDraft`
    - `approveStageAndAdvance`
    - `adjustWbsItem`
    - `createAgreementFromEstimate`
    - `reviewAgreementAgainstPolicies`
    - `applySelectedProposals`
- Each action:
  - Accepts typed input (validated with Zod).
  - Calls domain services (no direct DB access from LLM).
  - Returns a structured result (e.g. updated entities, summary messages, UI hints).

The LLM is given a “tool schema” describing these actions and is only allowed to invoke them by name with validated inputs.

#### 5.4 Copilot Entry Point

- Implemented as either:
  - A server action in a shared client component, or
  - An API route (e.g. `app/api/copilot/route.ts`) for streaming responses.
- Responsibilities:
  - Receive user message + context.
  - Build LLM prompt and tool configuration.
  - Run the LLM, capture any tool calls.
  - Execute corresponding actions in the registry.
  - Return:
    - `messages`: chat responses for the UI.
    - `updates`: data diffs (e.g. new drafts, new versions, updated WBS items).
    - `uiHints`: e.g. “navigate to Effort Estimate stage”, “highlight WBS row X”.

### 6. UI Architecture and Flows

#### 6.1 Dashboard (`/`)

- **Cards**:
  - **Estimates**:
    - Total count.
    - Last updated timestamp (most recent project update).
    - Link to `/estimates`.
  - **Contracts**:
    - Total count.
    - Last updated timestamp.
    - Link to `/contracts`.

#### 6.2 Estimates Workflow UI

- **Projects list (`/estimates`)**
  - Table/list of `Project`s with:
    - Name, client, current stage (badge), last updated.
    - Filters by current stage and status.

- **Project detail (`/estimates/[projectId]`)**
  - Layout:
    - **Stage stepper** along the top showing all 6 stages.
    - **Main stage panel**:
      - Entry criteria description.
      - Controls:
        - “Generate draft with Copilot” (per stage).
        - Rich text/plain text editor bound via `react-hook-form` + Zod.
        - “Save draft”.
        - “Approve & advance” (validates, saves `contentFinal`, creates `StageTransition`, updates `currentStage`).
    - **Transition timeline**:
      - List of `StageTransition` records with timestamps and notes.
    - **WBS section** (Effort Estimate stage):
      - Simple tree/table view of `WbsItem`s.
      - Inline editing for `name`, `role`, `hours`.
      - Aggregated totals (e.g. sum of hours).
    - **Copilot drawer/panel**:
      - Context‑aware chat for:
        - Generating stage drafts.
        - Adjusting WBS items.
        - Summarizing the current estimate.

#### 6.3 Contracts Workflow UI

- **Policy management (`/contracts/policies`)**
  - List of `PolicyRule`s.
  - Simple form (Chakra + `react-hook-form` + Zod) for creating/updating rules.

- **Agreements list (`/contracts`)**
  - Table of `Agreement`s:
    - Title, client, type, linked estimate badge, current version number, last updated.

- **Agreement detail (`/contracts/[agreementId]`)**
  - **Version selector / timeline**:
    - List or timeline of `AgreementVersion`s showing version number and createdAt.
  - **Main content panel**:
    - Plain text editor/viewer for the selected `AgreementVersion.content`.
    - Notes textarea (`AgreementVersion.notes`).
  - **Estimate link section**:
    - If linked to a `Project`, show summary (stages completed, WBS totals).
    - Alignment status/notes from `AgreementEstimateLink`.
  - **Copilot panel**:
    - Actions:
      - “Generate agreement from estimate” (creates new `AgreementVersion`).
      - “Review against policies” (creates `Proposal`s).

- **Review screen (within agreement detail)**
  - Side‑by‑side view:
    - Base agreement text.
    - Client draft text (pasted or uploaded and parsed as plain text).
  - Proposals list:
    - Each `Proposal` shows before/after text and rationale.
    - Checkbox to mark proposals for application.
  - Actions:
    - “Apply selected proposals” -> new `AgreementVersion` created and proposals marked `APPLIED`.

### 7. Copilot Thin-Slice for Week-One Demo

The goal is to implement **usable thin slices** rather than full coverage.

- **Estimates Copilot (priority)**:
  - Actions:
    - Generate drafts for at least two stages (e.g. Artifacts, Business Case).
    - Adjust WBS items (e.g. “increase QA hours by 20%”, “add DevOps line”).
  - UI:
    - Copilot panel on project detail page.
    - Optimistic updates to stage drafts and WBS when actions succeed.

- **Contracts Copilot (secondary within week)**:
  - Actions:
    - Draft a basic SOW from an estimate’s WBS + metadata.
    - Review a client draft against active `PolicyRule`s and propose changes.
  - UI:
    - Copilot panel on agreement detail page and review view.
    - Simple proposals list with manual selection and application.

### 8. Iterative Development Plan (High-Level)

- **Phase 1 (Scaffolding + Estimates core)**
  - Set up Next.js, Chakra UI, Prisma, Postgres.
  - Implement Prisma schema for Projects, Estimate stages, WBS, transitions.
  - Build dashboard, Estimates list, and basic Project detail page.
  - Implement stage transitions and WBS CRUD (no Copilot yet).

- **Phase 2 (Contracts basics)**
  - Extend schema with PolicyRule, Agreement, AgreementVersion, Proposal, AgreementEstimateLink.
  - Build Contracts list, Agreements detail view, and simple policy management.

- **Phase 3 (Copilot for Estimates)**
  - Implement LLM client and Copilot action registry.
  - Wire Copilot into Estimates detail page with:
    - Stage draft generation.
    - Simple WBS adjustment.

- **Phase 4 (Copilot for Contracts)**
  - Add actions for:
    - Generating agreements from estimates.
    - Policy‑based review creating `Proposal`s.
  - Wire into Agreements detail and review UI.

- **Phase 5 (Polish + Testing + Docs)**
  - Add tests for:
    - Stage transition rules.
    - WBS aggregation/validation.
    - Agreement versioning and proposal application.
  - Tighten UX, loading states, and error handling.
  - Complete `README.md`, `AI_ARTIFACTS.md`, `APPROACH.md`, `TESTING.md`, and Loom walkthrough.


