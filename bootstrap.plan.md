# Bootstrap Plan: Next.js + Prisma + Chakra UI Skeleton

### Goal

Set up a clean, minimal project skeleton that matches `ARCHITECTURE.md`: a Next.js App Router app with Chakra UI, `react-hook-form`, Zod, Prisma, and Postgres wiring, plus the basic folder structure. No domain logic, no Prisma models, and no Copilot behaviors yet.

### Steps

#### 1. Initialize the Next.js Application

1. From the repo root, run `create-next-app` to scaffold the app:

- Use TypeScript.
- Use the App Router.
- Use ESLint.
- Skip Tailwind.
- Use the default src directory structure (no `/src` nesting) so `app/` is at the root.

2. Verify the app runs locally with `npm run dev` or `yarn dev` and that the default page loads.

#### 2. Install Core Dependencies

1. Add UI and form libraries:

- `@chakra-ui/react @emotion/react @emotion/styled framer-motion`
- `react-hook-form`
- `zod @hookform/resolvers`

2. Add backend/ORM tooling:

- `prisma @prisma/client`

3. Add auxiliary tooling as needed (to be used later but installed now):

- `dotenv` (if not already covered by Next.js env handling).
- Testing stack (e.g. `vitest` / `jest` and `@testing-library/react`) can be deferred or installed in a later phase.

4. Ensure `package.json` scripts remain intact (`dev`, `build`, `start`, `lint`) after installation.

#### 3. Set Up Chakra UI and Global Layout (with Dashboard Skeleton)

1. Create a Chakra UI provider setup in `app/layout.tsx`:

- Wrap the root layout in `ChakraProvider`.
- Configure a basic custom theme file (e.g. `lib/theme.ts`) with minimal overrides.

2. Implement the dashboard skeleton in `app/page.tsx`:

- Use a Chakra `Container` with a top-level `Heading` (e.g. "Workflow Dashboard").
- Inside, add a `SimpleGrid` or `Stack` with two `Card`/`Box` components for **Estimates** and **Contracts**.
- In each card include:
- A label/heading (e.g. "Estimates" / "Contracts").
- A count placeholder text (e.g. "Count: --").
- A last-updated placeholder (e.g. "Last updated: --").
- A `Button` or `Link` component that navigates to `/estimates` or `/contracts` respectively.

#### 4. Scaffold App Routes and Directory Structure

1. Under `app/`, create route folders:

- `app/estimates/page.tsx` with a placeholder list view (e.g. “Estimates list TBD”).
- `app/estimates/[projectId]/page.tsx` with a placeholder detail view.
- `app/contracts/page.tsx` with a placeholder agreements list.
- `app/contracts/[agreementId]/page.tsx` with a placeholder agreement detail.
- Optionally, `app/contracts/policies/page.tsx` with a placeholder policy management view.

2. Under `lib/`, create empty or minimal modules matching the architecture:

- `lib/db.ts` (Prisma client placeholder, no schema yet).
- `lib/services/` directory with empty files: `estimatesService.ts`, `contractsService.ts` (exporting stubs only).
- `lib/zod/` directory with placeholder files for future schemas.
- `lib/copilot/` directory with placeholder files (`llmClient.ts`, `actions.ts`) exporting no-op or TODO stubs.
- `lib/utils/` for future helpers (empty index or placeholder file).

3. Ensure the existing `requirements/` and `spec/` folders remain untouched.

#### 5. Initialize Prisma and Database Configuration

1. From the project root, run `npx prisma init`:

- This **automatically creates** the `prisma/` directory with `schema.prisma` and adds a `DATABASE_URL` entry to `.env`.
- Do **not** manually create the `prisma/` folder or `schema.prisma`; rely on the CLI output.