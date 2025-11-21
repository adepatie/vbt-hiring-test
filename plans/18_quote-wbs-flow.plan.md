# Auto-save WBS and Quote Generation

## Overview

Implement debounced auto-save for WBS items and add a "Generate Quote & Advance" button in the Effort tab that generates quote terms and advances to the QUOTE stage.

## Implementation Tasks

### 1. Add Debounced Auto-Save to WbsEditor

**File**: `app/estimates/[projectId]/stage-panels.tsx`

- Add `useEffect` hook that watches form changes via `useWatch`
- Implement debounced save logic (500ms delay) using a ref to track timeout
- Auto-save only when:
  - Form is dirty (has changes)
  - User has roles configured
  - Can modify (canEdit && hasRoles)
- Show subtle loading state during auto-save (optional: small indicator)
- Prevent auto-save if manual save is in progress
- Extract save logic into a reusable function to avoid duplication

**Key changes**:

```typescript
const watchedItems = useWatch({ control, name: "items" }) ?? [];
const [isAutoSaving, setIsAutoSaving] = useState(false);
const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  // Debounce auto-save logic here
}, [watchedItems, hasRoles, canModify]);
```

### 2. Add "Generate Quote & Advance" Button

**File**: `app/estimates/[projectId]/stage-panels.tsx`

- Add new button in WbsEditor component, placed after "Regenerate with Copilot" button
- Button should:

  1. Ensure WBS items are saved first (if dirty, trigger save)
  2. Calculate subtotal from current WBS items (hours × roleRate)
  3. Fetch overhead fee from pricing defaults or existing quote
  4. Build WBS summary string for Copilot
  5. Call `/api/copilot` with `generateQuoteTerms` action
  6. Save quote with generated paymentTerms and timeline
  7. Advance stage to QUOTE via `advanceStageAction`

- Show loading state during the process
- Disable button if:
  - No WBS items exist
  - No roles configured
  - Already in QUOTE stage
  - Auto-save or manual save in progress

**Button placement**: In the button group with "Add row" and "Regenerate with Copilot" (replacing "Save WBS" button)

**Implementation**:

```typescript
const handleGenerateQuoteAndAdvance = async () => {
  // 1. Save WBS if dirty
  // 2. Calculate totals
  // 3. Generate quote terms
  // 4. Save quote
  // 5. Advance stage
};
```

### 3. Helper Functions for Quote Generation

**File**: `app/estimates/[projectId]/stage-panels.tsx`

- Create helper function to calculate subtotal from WBS items
- Create helper function to build WBS summary string (for Copilot prompt)
- Reuse existing `getPricingDefaults` logic or fetch from service

### 4. Update UI/UX

- Remove the existing "Save WBS" button (replaced by auto-save functionality)
- Add visual feedback for auto-save (subtle indicator or toast on success)
- Ensure button states are clear (disabled reasons, loading states)

## Testing Considerations

- Verify auto-save triggers after 500ms of no changes
- Verify auto-save doesn't trigger during manual save
- Verify "Generate Quote & Advance" button flow works end-to-end
- Verify quote generation uses correct WBS totals
- Verify stage advancement happens after quote generation

## Notes

- Auto-save should be silent (no toast on every save, maybe only on error)
- The "Generate Quote & Advance" button provides a clear workflow path
- Existing "Save WBS" button remains for explicit user control