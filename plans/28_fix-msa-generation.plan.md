# Fix MSA Agreement Generation

I have implemented several fixes to address the "blank agreement" issue during MSA generation and improved error propagation.

## Changes Implemented

1.  **Robust Error Handling in Actions** (`app/contracts/actions.ts`)
    -   Added explicit checks for empty content from the LLM.
    -   If the LLM returns empty content, the action now returns `{ success: false, error: ... }` instead of failing silently.
    -   Added detailed server-side logging to track the generation process (content length, version updates).

2.  **Improved Prompt Engineering** (`lib/copilot/prompts/contracts.ts`)
    -   Updated `buildContractDraftPrompt` to explicitly instruct the LLM to use placeholders (`[Date]`, `[Name]`) if specific details are missing, rather than potentially returning an empty response or refusal.
    -   This is particularly important for MSAs which may not have a linked project estimate, leaving the LLM with less context than an SOW.

3.  **Error Propagation to UI**
    -   The `ContractGenerationContext` (from previous step) will now receive the explicit error from the server action and display a red error toast to the user ("Copilot returned empty content"), preventing the confusing "loading finished -> blank page" state.

## Verification
-   **MSA Generation:** Should now generate a template MSA even if no project is linked.
-   **Error Visibility:** If generation truly fails (empty content), the user will see an error toast explaining why.
-   **Logging:** Server logs will now show `[generateContractAction]` entries to help debug future issues.

