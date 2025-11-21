# Role Rate MCP Plan

## Todos

- schema-migration: Add Role model + persistence helpers + seed data
- mcp-role-tools: Implement MCP tools + prompts to list/create/update roles
- wbs-consumption: Use roles in WBS MCP generator + manual UI dropdown
- integration-tests: Cover role-aware WBS generation + role MCP tools
- docs-update: Document role management + env/test impacts

## 1. Schema & Seed (`prisma/schema.prisma`, `prisma/migrations/*`, `lib/db.ts`)

- Introduce `Role` model with `id`, `name`, `rate` (Decimal(10,2)), `createdAt/updatedAt`.
- Add relation from `WbsItem` to `Role` via `roleId` (nullable until enforced) and adjust existing prisma client types.
- Write a migration that creates the table and backfills existing `WbsItem` rows with a default role (or leaves null) plus adds foreign key.
- Update `lib/services/estimatesService.ts` helpers (`updateWbsItems`, new `listRoles`, etc.) to work with role IDs.
- Seed default roles (e.g., Delivery Lead $225, PM $180, Senior Engineer $165, QA $120, Designer $140) via `prisma/seed.ts` or dedicated seed helper invoked by `npm run db:seed` and dev API.

## 2. MCP Role Management (`lib/mcp/types.ts`, `lib/mcp/server.ts`, `lib/mcp/client.ts`, `lib/copilot/prompts/roles.ts`)

- Define new MCP request/response types for `roles.list`, `roles.create`, `roles.update` with Zod validation.
- Implement prompt builders / instructions ensuring Copilot can only mutate via these tools (e.g., enforce incremental changes, rate in dollars, dedupe names).
- Server handlers call Prisma service helpers to list/create/update roles; creation/update should coerce rates to Decimal(10,2) and audit via telemetry logs.
- Expose high-level client helpers (`mcpListRoles`, `mcpCreateRole`, `mcpUpdateRole`) for Copilot actions.

## 3. Role-Aware WBS Generation & UI (`lib/copilot/actions.ts`, `lib/copilot/prompts/wbs.ts`, `lib/copilot/context/estimates.ts`, `app/estimates/[projectId]/stage-panels.tsx`)

- When generating WBS items via MCP, pass the seeded role catalog so the LLM only uses known roles and returns `roleId` references (fallback to name matching if needed).
- Update `generateEffortFromSolutionInputSchema` and downstream mappings so Copilot-provided items require a valid role ID (or map from role name case-insensitively).
- In the manual WBS editor UI, replace free-text role field with a dropdown populated from `listRoles` service; ensure the form writes `roleId` and displays rate info.
- Provide safeguards (e.g., disabled create/edit buttons) since manual changes must go through Copilot; UI should show read-only rate values.

## 4. Tests (`tests/integration/mcpTools.integration.test.ts`, `tests/integration/copilotApi.integration.test.ts`, `lib/services/__tests__/*`)

- Add integration coverage for the new MCP role tools (list/create/update) and ensure role data propagates through WBS generation (generated items reference seeded role IDs, rates > 0).
- Extend existing WBS API integration spec to assert returned JSON includes `roleId`, `roleName`, and `rate` and survives DB round-trips.
- Add service-level tests for role CRUD logic, especially rate rounding and name normalization.

## 5. Documentation & Dev Workflow (`README.md`, `TESTING.md`, `APPROACH.md`)

- Document the purpose of the Roles table, how to manage roles via Copilot commands, and note that manual UI is pick-only.
- Update testing docs to mention the new MCP role tools, required env vars, and any seed assumptions.
- Call out migration + seeding steps in the onboarding or dev workflow sections so contributors know to rerun `npm run db:push` / `npm run db:seed` after pulling.