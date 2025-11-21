# Refactor Seed & Ingest Contracts (No Policies)

## 1. Seed Script Separation

- **Rename `prisma/seed.ts`** to `prisma/seedEstimates.ts`.
- **Create new `prisma/seed.ts`**:
    - This will be the "Main" seed.
    - It should call the contract ingestion logic (step 2).
    - It should **NOT** seed default policies, yet.
    - It should **NOT** delete/reset estimates data by default.

## 2. Contract Ingestion Logic

- **Create `prisma/seedDocs.ts`**:
    - Import `mammoth` and `fs`.
    - **Sample Agreements**:
        - Iterate through `requirements/samples/` for `.docx` files.
        - Extract text via `mammoth`.
        - Upsert into `ExampleAgreement` table.
    - **Policies**: Do NOT seed any policies. Ensure no other script seeds them either.

## 3. Update Package Scripts

- **Update `package.json`**:
    - `seed`: Runs the new `prisma/seed.ts` (App Init).
    - `seed:estimates`: Runs `prisma/seedEstimates.ts` (Demo Data).

## 4. UI & Backend Updates

- **`app/contracts/new/page.tsx`**: Add "Notes / Instructions" textarea.
- **`app/contracts/actions.ts`**: Handle `notes` and trigger `contracts.generateDraft` immediately.
- **`lib/copilot/prompts/contracts.ts`**: Ensure prompt uses inputs.

## 5. Testing

- Run `npm run seed` to verify sample ingestion (check DB for ExampleAgreements, no Policies).
- Verify "New Agreement" flow uses the ingested samples and notes.