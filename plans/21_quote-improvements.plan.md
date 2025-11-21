# Quote Generation Analysis & Improvements

## 1. Issues Investigated

### A. Data Integrity & Types
- **`rates` Field**: The `Quote` model in `prisma/schema.prisma` defines `rates` as `Json?`. In `lib/zod/estimates.ts`, it is `z.record(z.number().nonnegative()).nullable()`.
- **Risk**: Storing loose JSON without strict runtime validation on read can lead to crashes if the structure drifts (e.g. if role IDs change or if rate keys become invalid).
- **Current Implementation**: `saveQuote` manually builds `roleTotals` (which seems to map `Role Name -> Total Cost`, not `Role ID -> Hourly Rate`). This naming is confusing.
  - `roleTotals[roleName] = ... + lineTotal` suggests it stores the *sum of costs* per role, not the *rate* per role.
  - The Zod schema name `rates` implies it stores the hourly rate. This is a **naming collision/semantic error**.

### B. Calculation Logic
- **Logic Location**: `estimatesService.saveQuote` recalculates the subtotal from scratch every time by querying `WBSItem`s.
- **Redundancy**: `getQuoteForExport` *also* recalculates the subtotal from scratch.
- **Inconsistency**: If WBS items change but `saveQuote` isn't called, the stored `Quote.total` might be stale. The export function calculates it fresh, meaning the UI (showing stored `total`) and the Export (calculating fresh) could show different numbers.

### C. Missing Features from Requirements
- **Delivered State**: The requirement "Mark delivered" exists in the UI but the enforcement of locking the quote is loose (only UI-side checks).
- **Versioning**: No history tracking for quotes. If a rate changes or hours are updated, the old quote is lost.

## 2. Suggested Improvements

### A. Schema & Naming Fixes
1.  **Rename `rates` to `roleCostBreakdown`**: If it stores the total cost per role, name it accurately.
2.  **Store Snapshot of WBS**: To ensure the quote is a *record of truth* at a point in time, we should arguably store the snapshot of WBS items *in* the quote (or link to a specific WBS version), rather than re-querying mutable WBS items. *For this thin-slice, we will keep re-querying but fix the synchronization.*

### B. Robust Calculation & DRY
1.  **Centralize Calculation**: Create a helper `calculateQuoteTotals(projectId)` that returns `{ subtotal, overhead, total, breakdown }`.
2.  **Use Helper Everywhere**: Both `saveQuote` and `getQuoteForExport` (and the UI view) should use this single source of truth.

### C. Export Reliability
1.  **Type Safety**: Ensure `rates` (or `roleCostBreakdown`) is typed as `Record<string, number>` (RoleName -> Cost) explicitly.

## 3. Action Plan

1.  **Refactor `estimatesService.saveQuote`**:
    - Extract calculation logic into private helper `_calculateProjectTotals`.
    - Ensure `rates` field correctly stores `Role Name -> Total Cost`.
    - Fix Zod schema if needed to match this reality.

2.  **Refactor `getQuoteForExport`**:
    - Use the same `_calculateProjectTotals` helper to ensure CSV matches DB.

3.  **Update Zod Schema**:
    - Clarify `rates` vs `breakdown`.

4.  **Testing**:
    - Add a test case specifically for "Modify WBS -> Check Quote Total" to prove sync.

