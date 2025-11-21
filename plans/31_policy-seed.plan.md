# Plan: Add Default Policies to Seed

This plan outlines the steps to update the database seeding logic to include a comprehensive list of default policy rules as requested.

## Files to Modify

1.  `prisma/seedContracts.ts`: Refactor to export a `seedPolicies` function and update the list of policies.
2.  `prisma/seed.ts`: Update to import and call `seedPolicies` during the main seed process.

## Step 1: Refactor `prisma/seedContracts.ts`

I will modify `prisma/seedContracts.ts` to:

-   Export a new asynchronous function `seedPolicies()`.
-   Inside this function, define the `policies` array containing the 17 items provided by the user.
-   Implement idempotent seeding logic:
    -   Iterate through the policies.
    -   Check if a policy with the same `description` already exists using `prisma.policyRule.findFirst`.
    -   If it does not exist, create it.
-   Update the existing `main` function to call `seedPolicies()` so the script can still be run standalone.
-   Preserve the existing `seedExampleAgreements` logic within the `main` function (or a separate exported function) but ensure it doesn't conflict.

The policies to be added are:

1.  All invoices are due Net 30 unless otherwise agreed in writing.
2.  Net 45 payment terms may be accepted upon request.
3.  A 2% early-payment discount applies if the Client pays within 10 days.
4.  The Client owns all project-specific deliverables created under the agreement.
5.  The Vendor retains ownership of all pre-existing intellectual property.
6.  The Vendor retains ownership of generalized know-how, internal tools, and templates.
7.  The Client receives a non-exclusive, non-transferable license to use Vendor pre-existing tools solely as integrated into the deliverables.
8.  Each party provides indemnification only for third-party intellectual property infringement caused by its own materials.
9.  No party provides broad or one-sided indemnification.
10. Total Vendor liability is capped at the fees paid by the Client in the preceding 12 months.
11. Neither party is liable for consequential, incidental, special, or punitive damages.
12. Both parties must keep non-public information confidential.
13. Confidentiality obligations survive for two years after termination.
14. Neither party may solicit the other’s employees for 12 months following the engagement.
15. Non-solicitation restrictions do not apply to general, non-targeted job postings.
16. The agreement is governed by the laws of Florida.
17. Disputes are resolved exclusively in the state or federal courts of Miami-Dade County, Florida.

## Step 2: Update `prisma/seed.ts`

I will modify `prisma/seed.ts` to:

-   Import `seedPolicies` from `./seedContracts`.
-   Call `await seedPolicies()` inside the `main` function, before or after `seedDocs()`.

## Step 3: Verification

-   Run `npm run seed` (or `npx prisma db seed`) to verify the policies are added to the database without errors.
-   (Optional) Inspect the database (via `npx prisma studio` or query) to confirm the entries.