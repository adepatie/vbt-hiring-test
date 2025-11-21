# Implement "Review Agreement" Feature

I will implement the "Review Client Draft" workflow as a distinct, standalone process that handles incoming agreements, runs policy reviews, and manages versioning separately from the "Create Agreement" flow.

## 1. Backend: Dedicated Review Actions (`app/contracts/review/actions.ts`)

-   **Create `contracts/review/actions.ts`**:
    -   `createIncomingAgreementAction`: Accepts `type`, `counterparty`, `projectId` (optional), and `content`.
        -   Creates `Agreement` (Status: REVIEW).
        -   Creates `AgreementVersion` v1 (Content: `content`, Note: "Incoming client draft").
        -   Returns `agreementId`.
    -   `saveReviewedVersionAction`: Accepts `agreementId`, `content`, and `changeSummary`.
        -   Creates `AgreementVersion` v2 (Content: `content`, Note: `changeSummary` or "Applied policy review changes").
        -   Updates `Agreement` status to DRAFT (or APPROVED if ready).

## 2. Frontend: Review Interface (`app/contracts/review/review-interface.tsx`)

-   **State Management**:
    -   `originalDraft`: The text from v1 (immutable during review session).
    -   `proposals`: The list of changes returned by the LLM.
    -   `decisions`: A state object/map tracking which proposals are "Approved" vs "Rejected" (default: pending/rejected).
-   **Workflow**:

    1.  **Input**: User provides `Counterparty`, `Type`, and pastes `Text`.
    2.  **Initialization**: On "Start Review", call `createIncomingAgreementAction` to persist v1.
    3.  **Analysis**: Call `contracts.reviewDraft` (Copilot) using the persisted v1 content.
    4.  **Interaction**:

        -   Display proposals in a "Redline/Greenline" style diff.
        -   User can toggle "Approve" or "Reject" on any proposal indefinitely.
        -   **Crucially**: These toggles *only* update the `decisions` state. They do **not** modify the underlying document version yet.

    1.  **Completion**:

        -   "Confirm Changes" button triggers the finalization process.
        -   The system computes the final text by applying *only* the approved proposals to `originalDraft` in memory.
        -   Calls `saveReviewedVersionAction` with this final text to create v2.
        -   Redirect to `/contracts/[agreementId]`.

## 3. Implementation Details

-   **Diff UI**: Update proposal cards to clearly show "Original" vs "Proposed" with visual indicators (red background/green background).
-   **Dynamic Text Generation**: Implement a `computeFinalDraft(original, proposals, decisions)` helper.
    -   This ensures that toggling a decision off/on is non-destructive and always reversible until the final save.
    -   This helper will be used at the very end to generate the payload for `saveReviewedVersionAction`.

## 4. Dependencies

-   Uses `lib/copilot` for the LLM call.
-   Uses `contractsService` for DB operations (shared data model, separate logic).