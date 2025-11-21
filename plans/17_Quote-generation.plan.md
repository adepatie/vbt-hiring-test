# Quote Automation Plan

## Todos
- schema-pricing: Store overhead + quote metadata in Prisma/zod/service layers
- mcp-quote-tools: MCP tool to read/update overhead fee + expose quote generator
- quote-ui-export: Apply WBS rates to totals, add CSV/copy exports, expose delivered state
- workflow-cleanup: Remove Delivered stage/tab, ensure quote completion marks delivered
- docs-tests: Update README/TESTING and extend coverage for MCP + quote exports

## 1. Schema & Service Updates (`prisma/schema.prisma`, `lib/zod/estimates.ts`, `lib/services/estimatesService.ts`)
- Add `overheadFee` (Decimal, default 0) to `Quote` plus helper methods to fetch/update it.
- Extend quote-saving helpers to sum WBS items: role hours × rate + overhead; persist breakdown (per-role totals, line items) in a structured JSON field for export.
- Add service for `getQuoteForExport(projectId)` returning WBS detail, overhead, payment terms, and timeline ready for CSV.

## 2. MCP Overhead Tooling (`lib/mcp/types.ts`, `lib/mcp/server.ts`, `lib/mcp/client.ts`, `lib/copilot/prompts/quote.ts`)
- Introduce `quote.getPricingDefaults` + `quote.updatePricingDefaults` MCP tools so Copilot can read/set the flat overhead fee.
- Add a prompt builder for generating payment terms + timeline that takes WBS totals + context and returns JSON (terms, milestones).

## 3. Quote UI & Export Controls (`app/estimates/[projectId]/stage-panels.tsx`, `app/estimates/[projectId]/project-flow-view.tsx`, `app/estimates/actions.ts`, new helper under `lib/ui/`) 
- Replace manual inputs with auto-calculated subtotal/overhead/total; show per-role lines and highlight delivered status within Quote stage (remove separate Delivered tab/route).
- Add “Copy to clipboard” (structured text summary) and “Export CSV” buttons wiring into the server action that streams the CSV (`/api/projects/[id]/quote.csv`).
- Provide buttons to regenerate quote terms via Copilot, approve + set `delivered=true`, and disable edits once delivered.

## 4. Workflow Cleanup (`lib/utils/estimates.ts`, stage metadata/components)
- Drop `DELIVERED` from `EstimateStage` enum/order; adjust navigation badges and history to treat QUOTE completion as terminal, showing delivered state inline.
- Ensure `advanceStageAction` ends the workflow at QUOTE and surfaces delivered status/overhead config errors clearly.

## 5. Docs & Tests (`README.md`, `TESTING.md`, `tests/integration/copilotApi.integration.test.ts`, `tests/integration/mcpTools.integration.test.ts`)
- Document overhead fee management, CSV export instructions, and how delivered status now appears.
- Expand integration tests to cover MCP overhead update, quote generation with payment terms/timeline, CSV output shape, and marking delivered via the Quote stage.