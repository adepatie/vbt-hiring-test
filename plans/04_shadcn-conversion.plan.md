# Chakra→shadcn Migration (Big Bang)

## Overview

Replace every Chakra UI dependency in a single branch, adopt shadcn/ui defaults (Tailwind + Radix primitives), and keep feature parity before merging back to main.

## 1. Prep & Dependencies

- Remove Chakra-specific packages and theme helpers (`@chakra-ui/react`, `@chakra-ui/icons`, `@emotion/*`, `framer-motion`, `lib/theme.ts`).
- Install Tailwind + shadcn requirements (`tailwindcss`, `postcss`, `autoprefixer`, `@shadcn/ui`, `class-variance-authority`, `tailwind-merge`, `@radix-ui/react-*`, `lucide-react`, `sonner`, `clsx`).
- Run `npx shadcn-ui@latest init` with defaults to scaffold `tailwind.config.ts`, `postcss.config.mjs`, `components.json`, and the `components/ui` folder.

## 2. Global Styling & Theme

- Replace the current global CSS with Tailwind layers (`@tailwind base/components/utilities`) and drop Chakra-specific resets (`app/globals.css`).
- Configure `tailwind.config.ts` with shadcn default tokens; no need to port Chakra tokens per request.
- Update `tsconfig.json` / `eslint.config.mjs` if `cn` helper or path aliases are added by shadcn.

## 3. Providers & Toast Infrastructure

- Remove the Chakra provider wrapper shown below and introduce the shadcn `ThemeProvider` + `Toaster` components (e.g., `components/theme-provider.tsx`).
```13:19:app/providers.tsx
return (
  <ChakraProvider value={theme}>
    {children}
    <AppToaster />
  </ChakraProvider>
);
```

- Rewrite `lib/ui/toaster.tsx` to use the shadcn `toast` hook + `Toaster` (sonner) and update `appToaster` call sites (`app/estimates/project-list.tsx`, etc.) to import the new helper.

## 4. Component Refactors (per feature group)

- **Shared layout primitives**: Create Tailwind-based wrappers for `Container`, `Stack`, `Flex`, `Card`, `Badge`, `Table`, etc., re-exported from `components/ui`. This keeps page code readable while dropping Chakra-specific props.
- **Forms & inputs** (`app/estimates/project-list.tsx` form): Replace `<Field.Root>` groups with shadcn `Form`, `FormField`, `Input`, `Select`, `Button`, `Badge`, `Table` components. Keep react-hook-form/zod logic intact while mapping styling via Tailwind classes.
- **List/Detail pages**: Update all Chakra imports in:
  - `app/page.tsx`
  - `app/contracts/page.tsx`, `app/contracts/[agreementId]/page.tsx`, `app/contracts/policies/page.tsx`
  - `app/estimates/page.tsx`, `app/estimates/project-list.tsx`, `app/estimates/[projectId]/page.tsx`, `app/estimates/[projectId]/project-detail-view.tsx`
  - Loading states (`app/estimates/loading.tsx`, `app/estimates/[projectId]/loading.tsx`) to use shadcn skeletons.
- Ensure any remaining Chakra-specific props (e.g., `colorScheme`, responsive objects) are rewritten as Tailwind utility classes or shared component props.

## 5. Cleanup & Verification

- Remove unused files (`lib/theme.ts`, Chakra toaster) and update documentation references (e.g., `bootstrap.plan.md`, `APPROACH.md`).
- Run `npm run lint` + `npm run test` and manually verify key flows (project creation, navigation) with the new UI components.
- Perform visual regression spot-checks to ensure shadcn defaults look acceptable, opening `/estimates` and `/contracts` routes locally before merging.