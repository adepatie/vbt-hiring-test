# Contracts Workflow Implementation Plan

## 1. Database Schema & Domain Models

- **Update `prisma/schema.prisma`**:
- `PolicyRule`: Stores governance rules (e.g., "Net 30 payment").
- `ExampleAgreement`: Reference texts for MSA/SOW.
- `Agreement`: Core entity with type (MSA/SOW), counterparty, status (DRAFT, REVIEW, APPROVED).
- `AgreementVersion`: Tracks content history and change notes.
- **Relations**: Link `Agreement` to `Project` (optional) to enable cross-workflow context.
- **Action**: Run `prisma migrate dev`.

## 2. Core Services (CRUD) & Validation

- **Update `lib/services/contractsService.ts`**:
- Implement Policy management (add/list/remove).
- Implement Agreement lifecycle (create, list, get details).
- Implement Version control (add version, get latest).
- **Diff Logic**: Implement deterministic text replacement for applying proposals (verify `original_text` exists before replacing).
- **Pattern**: Match `estimatesService` structure (typed inputs, Prisma calls).
- **Create `lib/zod/contracts.ts`**: Define schemas for all inputs (Policy, Agreement, Proposals).

## 3. Policy Management UI & Seeding

- **Target**: `app/contracts/policies/page.tsx`
- **Features**:
- List view of active Policy Rules.
- "Add Rule" form (Server Action).
- Section for Example Agreements (upload/paste).
- **Seeding**: Create `prisma/seedContracts.ts` to populate default policies (e.g., "Net 30", "IP Ownership") and templates so the app is usable immediately.

## 4. Agreements List & Creation

- **Target**: `app/contracts/page.tsx` and `app/contracts/new/page.tsx`
- **Features**:
- Data table of agreements (Type, Counterparty, Date, Status).
- "New Agreement" button navigates to `/contracts/new`.
- **New Agreement Page**:
- Form Inputs: Type (MSA/SOW), Counterparty, Optional Project Link.
- Triggers initial draft generation via Server Action.
- Redirects to Agreement Detail on success.

## 5. Agreement Detail & Versioning

- **Target**: `app/contracts/[agreementId]/page.tsx`
- **Features**:
- Main view: Display agreement text (Markdown/Text).
- Sidebar: Version history timeline.
- Actions: "Edit", "Review Incoming", "Download".
- **Context**: Ensure URL/State provides `agreementId` for Copilot context.

## 6. LLM Integration (MCP & Context)

- **Context Builder**: Create `lib/copilot/context/contracts.ts`.
- `buildContractContext(agreementId)`: Fetches Agreement, Policies, and *linked Project Estimates* (if SOW).
- **Prompts**: Create `lib/copilot/prompts/contracts.ts`.
- **MCP Tools** (Add to `lib/mcp/server.ts`):
- `contracts.generate_draft`: Uses policies + examples + estimate context.
- `contracts.review_draft`: Analyzes input text against policies.
- `contracts.apply_change`: Updates text based on accepted proposal.
- **Server Actions**: Update `lib/copilot/actions.ts` to expose these to the UI.

## 7. Review & Proposal UI

- **Target**: `app/contracts/[agreementId]/review/page.tsx`
- **Features**:
- Input: Paste/Upload client draft.
- Output: List of "Change Proposals" (Diff view).
- Action: Accept/Reject proposals -> Generates new Version.

## 8. Estimate Validation (Cross-Workflow)

- **Feature**: Validate SOW against linked Estimate.
- **Logic**: Check WBS roles/hours and Quote rates/terms.
- **UI**: Warning/Success indicators on Agreement Detail.
- **Copilot**: "Check this SOW against the estimate" command.

## 9. Integration Testing

- **Target**: `tests/integration/contracts.test.ts`
- **Scope**:
- End-to-end flow: Create Policy -> Create Agreement -> Generate Draft -> Review Draft -> Apply Change.
- Cross-workflow: Create Estimate -> Create SOW linked to Estimate -> Validate SOW.
- MCP Tools: Verify `contracts.generate_draft` and `contracts.review_draft` produce valid outputs.
- **Tools**: Jest + Supertest (or existing test runner).