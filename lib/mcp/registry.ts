import { z, ZodSchema } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  generateBusinessCaseSchema,
  generateRequirementsSchema,
  generateSolutionSchema,
  generateWbsItemsSchema,
  getProjectDetailsSchema,
  searchProjectsSchema,
  upsertWbsItemsSchema,
  removeWbsItemsSchema,
  listAgreementsSchema,
  getAgreementSchema,
  listRolesSchema,
  createRoleSchema,
  updateRoleSchema,
  getPricingDefaultsSchema,
  updatePricingDefaultsSchema,
  generateQuoteTermsSchema,
  summarizeArtifactSchema,
  createContractSchema,
  createContractsFromProjectSchema,
  generateContractDraftSchema,
  reviewContractDraftSchema,
  validateContractSchema,
  createContractVersionSchema,
  updateContractNotesSchema,
  applyContractProposalsSchema,
} from "./schemas";
import type { McpLLMResponse } from "./types";
import { mcpLLMServer } from "./server";

export type ToolHandler<T = any> = (input: T) => Promise<McpLLMResponse>;

export interface ToolDefinition<T = any> {
  name: string;
  description: string;
  schema: ZodSchema<T>;
  execute: ToolHandler<T>;
}

/**
 * OpenAI's tool/function names must match `/^[a-zA-Z0-9_-]+$/`.
 * Our internal MCP tool identifiers use dotted namespaces
 * (e.g. "estimates.generateWbsItems"), so we need a stable mapping.
 */
const toOpenAiToolName = (internalName: string) =>
  internalName.replace(/[^a-zA-Z0-9_-]/g, "_");

// Registry map (keyed by internal MCP tool name)
export const MCP_TOOLS: Record<string, ToolDefinition> = {
  // --- Estimates / Content Generation ---
  "estimates.generateBusinessCaseFromArtifacts": {
    name: "estimates.generateBusinessCaseFromArtifacts",
    description: "Generates a Business Case draft from project artifacts. Requires projectId.",
    schema: generateBusinessCaseSchema,
    execute: (input) => mcpLLMServer.handleGenerateBusinessCase(input),
  },
  "estimates.generateRequirementsSummary": {
    name: "estimates.generateRequirementsSummary",
    description: "Generates a Requirements summary from the Business Case. Requires projectId.",
    schema: generateRequirementsSchema,
    execute: (input) => mcpLLMServer.handleGenerateRequirements(input),
  },
  "estimates.generateSolutionArchitecture": {
    name: "estimates.generateSolutionArchitecture",
    description: "Generates a Solution Architecture draft from Requirements. Requires projectId.",
    schema: generateSolutionSchema,
    execute: (input) => mcpLLMServer.handleGenerateSolutionArchitecture(input),
  },
  "estimates.generateWbsItems": {
    name: "estimates.generateWbsItems",
    description: "Generates WBS items from the Solution Architecture. Requires projectId.",
    schema: generateWbsItemsSchema,
    execute: (input) => mcpLLMServer.handleGenerateWbsItems(input),
  },
  "estimates.upsertWbsItems": {
    name: "estimates.upsertWbsItems",
    description: "Add or edit specific WBS rows without overwriting unspecified items.",
    schema: upsertWbsItemsSchema,
    execute: (input) => mcpLLMServer.handleUpsertWbsItems(input),
  },
  "estimates.removeWbsItems": {
    name: "estimates.removeWbsItems",
    description: "Remove one or more WBS rows by id.",
    schema: removeWbsItemsSchema,
    execute: (input) => mcpLLMServer.handleRemoveWbsItems(input),
  },
  "estimates.summarizeArtifact": {
    name: "estimates.summarizeArtifact",
    description: "Summarizes a raw artifact text file. Internal use mainly.",
    schema: summarizeArtifactSchema,
    execute: (input) => mcpLLMServer.handleSummarizeArtifact(input),
  },

  // --- Read Tools ---
  "estimates.searchProjects": {
    name: "estimates.searchProjects",
    description: "Search for projects by name.",
    schema: searchProjectsSchema,
    execute: (input) => mcpLLMServer.handleSearchProjects(input),
  },
  "estimates.getProjectDetails": {
    name: "estimates.getProjectDetails",
    description: "Get full project metadata, current stage, and content of all stages.",
    schema: getProjectDetailsSchema,
    execute: (input) => mcpLLMServer.handleGetProjectDetails(input),
  },
  "contracts.listAgreements": {
    name: "contracts.listAgreements",
    description: "List all agreements associated with a project.",
    schema: listAgreementsSchema,
    execute: (input) => mcpLLMServer.handleListAgreements(input),
  },
  "contracts.getAgreement": {
    name: "contracts.getAgreement",
    description: "Get details of a specific agreement, including its latest version content.",
    schema: getAgreementSchema,
    execute: (input) => mcpLLMServer.handleGetAgreement(input),
  },

  // --- Roles ---
  "roles.list": {
    name: "roles.list",
    description: "List all available delivery roles and their rates.",
    schema: listRolesSchema,
    execute: () => mcpLLMServer.handleListRoles(),
  },
  "roles.create": {
    name: "roles.create",
    description: "Create a new delivery role.",
    schema: createRoleSchema,
    execute: (input) => mcpLLMServer.handleCreateRole(input),
  },
  "roles.update": {
    name: "roles.update",
    description: "Update an existing delivery role (rate or name).",
    schema: updateRoleSchema,
    execute: (input) => mcpLLMServer.handleUpdateRole(input),
  },

  // --- Quote ---
  "quote.getPricingDefaults": {
    name: "quote.getPricingDefaults",
    description: "Get current global pricing defaults (e.g. overhead fee).",
    schema: getPricingDefaultsSchema,
    execute: () => mcpLLMServer.handleGetPricingDefaults(),
  },
  "quote.updatePricingDefaults": {
    name: "quote.updatePricingDefaults",
    description: "Update global pricing defaults.",
    schema: updatePricingDefaultsSchema,
    execute: (input) => mcpLLMServer.handleUpdatePricingDefaults(input),
  },
  "quote.generateTerms": {
    name: "quote.generateTerms",
    description: "Generate payment terms and timeline for a quote based on WBS.",
    schema: generateQuoteTermsSchema,
    execute: (input) => mcpLLMServer.handleGenerateQuoteTerms(input),
  },

  // --- Contracts ---
  "contracts.create": {
    name: "contracts.create",
    description: "Create a new Agreement (MSA or SOW).",
    schema: createContractSchema,
    execute: (input) => mcpLLMServer.handleCreateAgreement(input),
  },
  "contracts.createFromProject": {
    name: "contracts.createFromProject",
    description:
      "Create one or more agreements for a project using its estimates and artifacts.",
    schema: createContractsFromProjectSchema,
    execute: (input) => mcpLLMServer.handleCreateAgreementsFromProject(input),
  },
  "contracts.generateDraft": {
    name: "contracts.generateDraft",
    description: "Generate the content for an agreement based on instructions and policy.",
    schema: generateContractDraftSchema,
    execute: (input) => mcpLLMServer.handleGenerateContractDraft(input),
  },
  "contracts.reviewDraft": {
    name: "contracts.reviewDraft",
    description: "Review an incoming contract draft against policies.",
    schema: reviewContractDraftSchema,
    execute: (input) => mcpLLMServer.handleReviewContractDraft(input),
  },
  "contracts.validateAnalysis": {
    name: "contracts.validateAnalysis",
    description: "Validate an agreement against the project estimate.",
    schema: validateContractSchema,
    execute: (input) => mcpLLMServer.handleValidateContract(input),
  },
  "contracts.createVersion": {
    name: "contracts.createVersion",
    description: "Create a new version of a contract with updated content.",
    schema: createContractVersionSchema,
    execute: (input) => mcpLLMServer.handleCreateContractVersion(input),
  },
  "contracts.updateNotes": {
    name: "contracts.updateNotes",
    description: "Update the notes for an agreement.",
    schema: updateContractNotesSchema,
    execute: (input) => mcpLLMServer.handleUpdateContractNotes(input),
  },
  "contracts.applyProposals": {
    name: "contracts.applyProposals",
    description:
      "Apply accepted policy review proposals to an agreement and save a new version.",
    schema: applyContractProposalsSchema,
    execute: (input) => mcpLLMServer.handleApplyContractProposals(input),
  },
};

/**
 * Returns an array of tool definitions compatible with OpenAI's
 * Chat Completion / tool calling API.
 *
 * Tool names are sanitized to satisfy OpenAI's `/^[a-zA-Z0-9_-]+$/` requirement.
 */
export function getOpenAiTools() {
  return Object.values(MCP_TOOLS).map((tool) => {
    const openAiName = toOpenAiToolName(tool.name);
    return {
      type: "function" as const,
      function: {
        name: openAiName,
        description: tool.description,
        parameters: zodToJsonSchema(tool.schema),
      },
    };
  });
}

/**
 * Mapping from OpenAI-safe tool name back to internal MCP tool name.
 * This lets us expose safe identifiers to the LLM while still
 * executing the correct MCP handler and reporting the original
 * tool name in our chat transcript.
 */
export function getOpenAiToolNameMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const tool of Object.values(MCP_TOOLS)) {
    const openAiName = toOpenAiToolName(tool.name);
    map[openAiName] = tool.name;
  }
  return map;
}

