# Contracts Workflow Completion Plan

This plan addresses gaps in the "Create Agreement" and "Review/Validate" flows, specifically enabling Copilot-driven agreement creation, estimate validation, and improved UI for estimate linking (SOW only).

## Gaps Identified

1.  **Copilot Creation:** No MCP tool exists to *create* an agreement record (DB entry).
2.  **Estimate Validation:** The current review logic checks policies but fails to "validate against WBS ... and quote" as required.
3.  **Upload Support:** The Review UI supports text paste but lacks file upload.
4.  **UI Improvements:** NDA should be removed. Estimate linking should be SOW-specific, optional, and use an autocomplete.

## Implementation Steps

### 1. Remove NDA References

-   **Files:** `app/contracts/new/page.tsx`, `app/contracts/policies/page.tsx`, `lib/zod/contracts.ts`, `app/contracts/review/review-interface.tsx`.
-   **Action:** Remove "NDA" from dropdowns and schemas.

### 2. Implement Estimate Autocomplete & Create Flow Updates

-   **Component:** Create `app/contracts/components/estimate-picker.tsx` (search Projects).
-   **UI:** Update `NewAgreementPage`:
    -   Remove `projectId` text input.
    -   If `type === "SOW"`, show `EstimatePicker`.
    -   Hide picker if `MSA`.
-   **Action:** Update `createAgreementAction` to handle the linked project.

### 3. Implement Post-Creation Linking

-   **UI:** Update `app/contracts/[agreementId]/page.tsx`.
    -   If `type === "SOW"` and no `projectId`, show "Link to Estimate" button.
    -   Add a Dialog containing `EstimatePicker`.
-   **Action:** Create `linkEstimateAction(agreementId, projectId)` in `app/contracts/actions.ts`.
    -   Updates DB.
    -   Triggers `generateContractAction` (creating new version with estimate context).

### 4. Implement `contracts.create` MCP Tool

Enable Copilot to create agreement records.

-   **File:** `lib/mcp/server.ts`, `lib/mcp/types.ts`
-   **Action:** Add `contracts.create` tool definition and handler.

### 5. Implement `contracts.validateAnalysis` MCP Tool

Enable validation of agreements against linked estimates.

-   **File:** `lib/mcp/server.ts`, `lib/mcp/types.ts`, `lib/copilot/prompts/contracts.ts`
-   **Action:** Create tool `contracts.validateAnalysis`.
-   **Prompt Logic:** Context: Agreement + Linked Estimate -> Discrepancies.

### 6. Enhance `contracts.generateDraft` Prompt

Ensure generated contracts strictly follow linked estimates.

-   **File:** `lib/copilot/prompts/contracts.ts`
-   **Action:** Strengthen instructions to use WBS/Quote data.

## Verification

-   Test creation of SOW with and without linked estimate.
-   Test linking estimate to existing SOW.
-   Test Copilot creation and validation.