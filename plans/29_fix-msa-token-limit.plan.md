# Fix MSA Generation Token Limits

I have updated the contract generation logic to handle large documents by increasing the token limits and implementing retry logic.

## Changes Implemented

1.  **Increased Max Tokens:** (`lib/mcp/server.ts`)
    -   Increased the maximum token limit for contract generation from a hardcoded `4000` to a dynamic range of `5000` to `12000` tokens.
    -   This significantly increases the capacity for long MSA agreements, which often exceed standard lengths.

2.  **Implemented Retry Logic:** (`lib/mcp/server.ts`)
    -   Replaced the simple `callProviderLLM` call with `callWithContentRetry`.
    -   This function automatically detects if the generation was truncated due to length limits (`finishReason === "length"`).
    -   If truncated, it retries the generation with a higher token limit (increasing by ~50% each time, up to the new 12k max).
    -   This ensures that if a contract is cut off, the system attempts to generate it again with more capacity rather than returning an incomplete or empty string.

## Verification
-   **MSA Generation:** Long agreements should now complete successfully, even if they require more than 5000 tokens.
-   **Retries:** If the first attempt is truncated, you may notice the generation takes slightly longer as it retries with more capacity, but the result will be complete.
