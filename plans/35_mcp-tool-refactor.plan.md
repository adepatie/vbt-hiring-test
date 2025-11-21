# MCP Tool Interface Refactor & Chat Readiness Plan

This plan addresses the missing schema registry, context dependency handling, and lack of read capabilities in the current MCP system.

## 1. Schema Standardization & Registry

We need a single source of truth for tool definitions to feed into OpenAI/Chat Agents.

- **Install Dependency**: Add `zod-to-json-schema` to generate OpenAI-compatible schemas from Zod.
- **Create `lib/mcp/schemas.ts`**:
- Centralize Zod schemas for ALL MCP tools.
- Reuse existing schemas from `lib/zod/` where possible.
- Define missing schemas (`generateQuoteTerms`, `contracts.*`).
- **Create `lib/mcp/registry.ts`**:
- Define a constant `MCP_TOOLS` registry mapping tool names to:
  - `name` (string)
  - `description` (string) - optimized for LLM understanding.
  - `schema` (ZodSchema)
  - `execute` (Function) - reference to the handler.
- Export `getOpenAiTools()` helper to generate the `tools` array for the Chat API.

## 2. Implement Read Tools

The Chat Agent needs to "see" the world before acting on it.

- **Update `lib/mcp/server.ts`** to add:
- `estimates.getProjectDetails`: Returns project metadata, current stage, and stage content (Business Case, Requirements, etc.).
- `contracts.getAgreement`: Returns agreement details, current version content, and metadata.
- `contracts.listAgreements`: Lists agreements for a project.
- **Add Schemas**: Define input/output schemas for these new tools in `lib/mcp/schemas.ts`.

## 3. Refactor MCP Server

- **Update `lib/mcp/server.ts`**:
- Replace the large `switch` statement with a dynamic lookup from `MCP_TOOLS` registry.
- Implement uniform Zod validation using the registry schemas before execution.
- Ensure all tool handlers return `McpLLMResponse` with consistent formatting.

## 4. Context Strategy

- **Schema Design**:
- Keep `projectId` and `agreementId` as **required** in the Zod schemas.
- The Chat Interface (frontend/API) will be responsible for injecting these values into the tool calls if the LLM omits them, or the LLM will be instructed to include them from its system prompt context.
- *Reasoning*: Making them optional in the schema confuses the LLM about whether it needs to know them.

## 5. Verification

- **Test Plan**:
- Create `tests/unit/mcpRegistry.test.ts` to verify JSON schema generation.
- Update `tests/integration/mcpTools.integration.test.ts` to test the new Read tools.