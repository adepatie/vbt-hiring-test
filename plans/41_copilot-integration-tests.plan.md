# Plan: Copilot Full Integration Tests & Seeding

This plan implements the full suite of Copilot integration tests against the actual OpenAI API, ensuring all examples from `test-prompt.txt` are covered. It also updates the database seeding to provide the necessary "Project Apollo" and contract data.

## 1. Update Seed Data (`prisma/seedDemoData.ts` & `prisma/seed.ts`)

-   **Create `prisma/seedDemoData.ts`**:
    -   **Roles**: Ensure standard roles exist (Backend, Frontend, Design, PM).
    -   **Project**: Create "Project Apollo" (Stage: QUOTE).
    -   **Artifacts**: Add dummy artifacts (Scope, Transcript).
    -   **WBS**: Add WBS items for Apollo (Backend, Frontend, Design tasks).
    -   **Quote**: Create a calculated Quote for Apollo.
    -   **Agreement**: Create an "Apollo MSA" linked to the project.
        -   Add an initial `AgreementVersion`.
        -   Add sample `reviewData` to support "Summarize pushbacks" (simulating a client redline).
-   **Update `prisma/seed.ts`**: Import and await `seedDemoData`.

## 2. Create Integration Test Suite (`tests/integration/copilotFullFlow.integration.test.ts`)

-   **Setup**: Use `describe.runIf(shouldRunOpenAiSuite)` to only run when API keys are present.
-   **Helper**: `seedDemoData()` calls to ensure fresh state before suite.
-   **Test Cases**:

    1.  **"What's the current total for Project Apollo?"**

        -   *Flow*: `searchProjects` -> `getProjectDetails` -> LLM Answer.
        -   *Verify*: Response contains the correct dollar amount from the seeded Quote.

    1.  **"Increase Backend hours by 10%."** (Context: Project Apollo)

        -   *Flow*: `updateWbsItems` -> Side Effect (`recalculateQuoteTotals`).
        -   *Verify*: WBS hours increased in DB, Quote total updated.

    1.  **"Add a QA line: 40h at $90/hr, rationale 'regression pass'"**

        -   *Flow*: `updateWbsItems` (creates new Role "QA" or "QA (Custom)" if rate differs).
        -   *Verify*: New WBS item created, new Role created (if needed), hours/rate match.

    1.  **"Create a new MSA and SOW for Project Apollo; use the scope and estimate..."**

        -   *Flow*: `getProjectDetails` (reads Artifacts/WBS) -> `contracts.createVersion` (creates MSA & SOW drafts).
        -   *Verify*: Two new Agreements created (MSA, SOW) linked to Apollo.

    1.  **"Summarize pushbacks on this agreement."** (Context: Apollo MSA)

        -   *Flow*: Read `reviewData` from Agreement -> LLM Summary.
        -   *Verify*: Response mentions the seeded pushback points.

    1.  **"Add a note: ‘Net 45 acceptable with 2% discount.’"**

        -   *Flow*: `contracts.updateNotes`.
        -   *Verify*: `reviewData.notes` updated in DB.

    1.  **"Apply the payment-terms proposals and create a new version."**

        -   *Flow*: `contracts.createVersion` (LLM incorporates notes/proposals into new text).
        -   *Verify*: New `AgreementVersion` created, content reflects "Net 45".

## 3. Execution

-   Run `npx prisma db seed` (to verify seed works).
-   Run `npm run test tests/integration/copilotFullFlow.integration.test.ts`.