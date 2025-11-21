# Develop Integration Tests for Agreement Generation

## 1. Create Test File

- **File**: `tests/integration/contractGeneration.test.ts`
- **Scope**:
    - **Setup (`beforeAll`)**:
        - Clean up DB (`Agreement`, `PolicyRule`, `ExampleAgreement`).
        - Seed a `PolicyRule` (e.g., "Net 30").
        - Seed an `ExampleAgreement` (simulating ingested content).
    - **Test Case**: "Generate Draft with OpenAI"
        - Create an empty `Agreement` (SOW).
        - Call `mcpLLMServer.handle("contracts.generateDraft")` with `instructions` (user notes).
        - **Assertions**:
            - Response is success.
            - Content is non-empty string.
            - Content contains keywords from Policy ("Net 30").
            - Content contains keywords from Example Agreement (to verify context usage).
            - Content contains text related to the `instructions` provided.

## 2. Update Package Scripts

- **Update `package.json`**:
    - Add `"test:contracts:gen": "RUN_OPENAI_TESTS=1 VITEST_MIN_THREADS=1 VITEST_MAX_THREADS=1 vitest run tests/integration/contractGeneration.test.ts"`

## 3. Verification

- Run `npm run test:contracts:gen` to verify the test passes (assuming valid API key is present in environment).