# Fix Critical Bugs in Estimates and Contracts

The user has reported two critical bugs:

1.  **Infinite Render Loop** in `NarrativeStageForm` ("Maximum update depth exceeded").
2.  **Server Chunk Load Failure** in `AgreementDetailPage` (Circular dependency).

Additionally, I identified a missing Context Provider that will cause client-side crashes in the Contracts flow.

## 1. Fix Infinite Render Loop in `NarrativeStageForm`

The `useEffect` in `NarrativeStageForm` depends on `regenerateConfig`, which is a new object reference on every render, causing an infinite loop when `setActions` triggers a re-render.

### `app/estimates/[projectId]/stage-panels.tsx`

-   Wrap `regenerateConfig` in `useMemo`.

## 2. Fix Circular Dependency in `artifact-summary.ts`

The chunk load error is caused by a cycle:
`lib/mcp/server.ts` → `estimatesService` → `lib/server/artifact-summary.ts` → `lib/mcp/client.ts` → `lib/mcp/server.ts`.

I will break this cycle by making `artifact-summary.ts` call the lower-level `providerClient` directly instead of routing through the MCP server via `client.ts`.

### `lib/server/artifact-summary.ts`

-   Remove imports from `../mcp/client`.
-   Import `callProviderLLM` from `../mcp/providerClient`.
-   Import `buildArtifactSummaryPrompt` and instruction constants from `../copilot/prompts/artifactSummaries`.
-   Re-implement `runArtifactSummarization` to call `callProviderLLM` directly.

## 3. Add Missing ContractGenerationProvider

The `AgreementContentWrapper` and `LinkEstimateDialog` components use `useContractGeneration`, but the provider is not rendered in the layout. This will cause a client runtime error.

### `app/contracts/layout.tsx`

-   Import `ContractGenerationProvider` from `./contract-generation-context`.
-   Wrap the `{children}` of the main content area with `<ContractGenerationProvider>`.

## Verification

-   Verify linter passes.
-   The circular dependency fix should resolve the "Failed to load chunk" error.
-   The memoization should resolve the "Maximum update depth exceeded" error.