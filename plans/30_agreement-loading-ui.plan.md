# Improve Agreement Creation Flow

I have implemented an asynchronous agreement creation flow with persistent loading states and toast notifications, addressing both the UX issues and the "empty contract" bug.

## Changes Implemented

1.  **Global Generation Context** (`app/contracts/contract-generation-context.tsx`)

    -   Tracks ongoing agreement generation tasks.
    -   Displays a persistent "Generating..." toast using `sonner` while the background task runs.
    -   Handling success/error toasts globally.
    -   Triggers `router.refresh()` upon completion to update the UI.

2.  **Separated Server Actions** (`app/contracts/actions.ts`)

    -   `createAgreementAction`: Only creates the database record (fast) and returns the ID.
    -   `generateContractAction`: Handles the LLM generation (slow), updates the database, and handles errors explicitly.

3.  **Updated Creation Flow** (`app/contracts/new/page.tsx`)

    -   Form submission now calls `createAgreementAction`.
    -   Immediately triggers `startGeneration` (from context) to kick off the background task.
    -   Navigates to the new contract page immediately, without waiting for generation.

4.  **Contract Detail Page** (`app/contracts/[agreementId]/page.tsx`)

    -   Added `AgreementContentWrapper` to check the global generation status.
    -   Displays a loading spinner ("Generating Draft...") in place of the content area while generation is in progress.
    -   Automatically reveals the content when generation completes (via `router.refresh()`).

## Verification

-   **Loading State:** The user will see a toast notification and a specific loading state on the contract page.
-   **Empty Contract Fix:** By separating the actions, we ensure the navigation happens immediately, and the content is populated when ready. If generation fails, an error toast is shown, and the "Empty" placeholder remains, rather than silently failing.