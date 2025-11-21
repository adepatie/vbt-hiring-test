# Quote Generation Fix Plan

## 1. Issue Analysis
The user encountered a `ZodError` ("too_big") when generating a quote.
- **Field**: `timeline`
- **Limit**: 2000 characters
- **Actual**: > 2000 characters
- **Cause**: The `quoteSchema` and `quoteInputSchema` in `lib/zod/estimates.ts` restrict `paymentTerms` and `timeline` to 2000 chars. The LLM-generated content for these fields can easily exceed this, especially for complex projects.

## 2. Proposed Solution
Increase the character limit for `paymentTerms` and `timeline` to `20000` (matching `longFormText` used for other narrative fields like Business Case).

### Files to Change
- `lib/zod/estimates.ts`

### Changes
- Update `quoteSchema` definitions for `paymentTerms` and `timeline`.
- Update `quoteInputSchema` definitions for `paymentTerms` and `timeline`.

## 3. Verification
- Review `lib/zod/estimates.ts` after edit.
- (Implicit) User will retry the action.

