# Architecture Documentation Update Plan

## Goal
Create a new architecture document that accurately reflects the current state of the application (Estimates-focused, MCP-based Copilot) while maintaining the roadmap for the missing Contracts workflow.

## Analysis of Current State vs. Original Spec

### 1. Core Discrepancies
- **Contracts Domain**: The original spec detailed a full Contracts domain (`Agreement`, `PolicyRule`, etc.). The current codebase (`prisma/schema.prisma`) implements only the Estimates domain. Contracts code is currently limited to UI placeholders (`app/contracts/`).
- **Copilot Implementation**: The original spec mentioned a generic "Action Registry". The implementation uses a specific **MCP (Model Context Protocol)** pattern (`lib/mcp/server.ts`) to handle LLM tools and context.
- **Directory Structure**: largely aligns, but `lib/mcp` is a significant new component.

### 2. Plan to Update ARCHITECTURE.md

I will create a new document `spec/ARCHITECTURE.md` (archiving the old one if necessary) with the following structure:

#### A. Tech Stack & Constraints (Updated)
- Confirm Next.js App Router, Prisma, Postgres.
- Add **Model Context Protocol (MCP)** as the core interaction layer for Copilot.

#### B. Application Structure (Refined)
- Update directory layout to include `lib/mcp/` and `app/api/` subroutes.
- Describe the `McpLLMServer` class as the central orchestrator for Copilot tools.

#### C. Domain Models (Split into "Implemented" and "Planned")
- **Implemented (Estimates)**: Document `Project`, `Artifact`, `BusinessCase`, `Requirements`, `Solution`, `WBSItem`, `Quote`.
- **Planned (Contracts)**: Document the intended `Agreement`, `PolicyRule`, `Proposal` models as "To Be Implemented" (referencing the requirements).

#### D. Logical Layers (Updated)
- **Presentation**: Next.js Components.
- **Orchestration**: Server Actions (`app/estimates/actions.ts`).
- **Copilot/AI**: `lib/mcp` (Server) + `lib/copilot` (Prompts/Context).
- **Data**: Prisma + Postgres.

#### E. Workflows
- **Estimates**: Detail the 6-stage flow as implemented.
- **Contracts**: Mark as "Roadmap" / "Next Phase".

## Execution Steps
1. **Rename** current `spec/ARCHITECTURE.md` to `spec/ARCHITECTURE_v1.md` to preserve history.
2. **Write** new `spec/ARCHITECTURE.md` based on the structure above.
3. **Verify** consistency between the new doc and `prisma/schema.prisma`.

