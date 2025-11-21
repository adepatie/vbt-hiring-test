# Plan: Implement Missing Copilot Features

This plan addresses the gaps identified in the `test-prompt.md` examples, specifically enabling granular WBS editing (with custom role creation), project search, contract versioning, and contract notes.

## 1. Estimates: Project Search
- **Service**: Add `searchProjects(query: string)` to `lib/services/estimatesService.ts`.
  - Use `prisma.project.findMany` with `where: { name: { contains: query, mode: 'insensitive' } }`.
- **Schema**: Add `searchProjectsSchema` to `lib/mcp/schemas.ts`.
- **Tool**: Register `estimates.searchProjects` in `lib/mcp/registry.ts`.
- **Handler**: Add `handleSearchProjects` to `lib/mcp/server.ts`.

## 2. Estimates: Granular WBS Editing
- **Schema**: Add `updateWbsItemsSchema` to `lib/mcp/schemas.ts`.
  - Input: `projectId`, `items` array (task, roleName, roleRate, hours, id?).
- **Tool**: Register `estimates.upsertWbsItems` in `lib/mcp/registry.ts`.
- **Handler**: Add `handleUpdateWbsItems` to `lib/mcp/server.ts`.
  - **Logic**:
    - Iterate through items.
    - For each item, check if a role with `roleName` and `roleRate` exists using `prisma.role.findUnique` (or `findFirst`).
    - If not, create it using `prisma.role.create`.
    - Map the item to the `roleId`.
    - Call `estimatesService.updateWbsItems`.
- **Side Effects**: In `lib/copilot/actions.ts`, add `estimates.upsertWbsItems` to `SIDE_EFFECTS` causing `recalculateQuoteTotals` and `maybeRegenerateQuoteTerms`.

## 3. Contracts: Versioning & Notes
- **Service**:
  - Ensure `contractsService.createVersion` is exposed (it exists).
  - Add `updateAgreementNotes(agreementId: string, notes: string)` to `lib/services/contractsService.ts`.
    - Updates `agreement.reviewData` merging `{ notes: notes }`.
- **Schema**:
  - Add `createContractVersionSchema` (input: agreementId, content, changeNote).
  - Add `updateContractNotesSchema` (input: agreementId, notes).
- **Tool**: Register `contracts.createVersion` and `contracts.updateNotes` in `lib/mcp/registry.ts`.
- **Handler**: Add `handleCreateContractVersion` and `handleUpdateContractNotes` to `lib/mcp/server.ts`.

## 4. Verification
- Update `tests/integration/copilotChat.integration.test.ts` to include tests for:
  - Searching for a project.
  - Updating a WBS item with a custom rate (verifying new role creation).
  - Creating a contract version.
  - Updating contract notes.
