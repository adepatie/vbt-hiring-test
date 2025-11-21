# Codebase Audit & Refactor Plan

## Audit Findings

### Strengths

- **Architecture**: Clear separation of concerns with `app/` (UI/Routing), `lib/services` (Business Logic), and `lib/mcp` (AI Protocol).
- **Data Access**: Consistent use of Prisma and Zod for data validation in services.
- **UI Composition**: Layout-driven data fetching for navigation keeps pages focused.
- **Testing**: Good unit testing pattern with mocked DB for services.

### Inconsistencies & Opportunities

1.  **Server Actions**: `app/contracts/actions.ts` uses `FormData` and manual validation, whereas `app/estimates/actions.ts` uses typed arguments and Zod schemas.
2.  **Code Complexity**: `lib/copilot/actions.ts` contains the monolithic `chatRun` function which handles too many responsibilities (history, tools, side effects).
3.  **Error Handling**: `app/api/copilot/route.ts` maps generic errors but could be more robust in handling specific service errors.
4.  **Type Safety**: Some loose typing in `copilotActions` mapping.

## Plan

### 1. Standardize Server Actions

Refactor `app/contracts/actions.ts` to align with the pattern in `app/estimates/actions.ts`.

- Change `createAgreementAction` to accept a typed object instead of `FormData`.
- Use `createAgreementSchema` from `lib/zod/contracts` for validation.
- Ensure the client component (`app/contracts/new/page.tsx`) calls the action with the correct object structure.

### 2. Refactor Copilot Actions

Break down the `chatRun` function in `lib/copilot/actions.ts` into smaller, testable functions.

- Extract `executeToolCalls` logic.
- Extract `handleSideEffects` logic.
- Extract `summarizeExecution` logic.
- Improve type safety for tool execution results.

### 3. Strengthen API Error Handling

Update `app/api/copilot/route.ts` to explicitly handle `CopilotLLMError` and `ZodError` with appropriate status codes and messages, ensuring a consistent API response format.

### 4. Verify & Test

- Run existing tests to ensure no regressions.
- Add a smoke test for the refactored contracts action if needed.
- Manually verify the contracts creation flow and copilot chat flow.

## Implementation Todos

- [ ] Standardize `app/contracts/actions.ts` to use typed inputs and Zod.
- [ ] Update `app/contracts/new/page.tsx` (or client form) to call the updated action.
- [ ] Extract `executeToolCalls` and helper functions from `lib/copilot/actions.ts`.
- [ ] Refactor `chatRun` to use the extracted helpers.
- [ ] Update `app/api/copilot/route.ts` with robust error handling.
- [ ] Verify `estimates` and `contracts` flows manually.