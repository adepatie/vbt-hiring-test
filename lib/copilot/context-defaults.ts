import type { CopilotWorkflow } from "./types";

const ESTIMATE_PROJECT_CONTEXT_TOOLS = new Set<string>([
  "estimates.generateBusinessCaseFromArtifacts",
  "estimates.generateRequirementsSummary",
  "estimates.generateSolutionArchitecture",
  "estimates.generateWbsItems",
  "estimates.upsertWbsItems",
  "estimates.removeWbsItems",
  "estimates.summarizeArtifact",
  "estimates.getProjectDetails",
  "quote.generateTerms",
  "contracts.createFromProject",
]);

const CONTRACT_AGREEMENT_CONTEXT_TOOLS = new Set<string>([
  "contracts.getAgreement",
  "contracts.generateDraft",
  "contracts.reviewDraft",
  "contracts.validateAnalysis",
  "contracts.createVersion",
  "contracts.updateNotes",
  "contracts.applyProposals",
]);

type ToolArgs = Record<string, unknown>;

export function applyContextDefaults(
  rawArgs: unknown,
  toolName: string,
  workflow?: CopilotWorkflow,
  entityId?: string,
  entityType?: "project" | "agreement",
): ToolArgs {
  let args: ToolArgs;

  if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
    args = { ...(rawArgs as Record<string, unknown>) };
  } else {
    args = {};
  }

  if (!entityId) {
    return args;
  }

  const projectContext =
    entityType === "project" ||
    (!entityType && workflow === "estimates");

  const agreementContext =
    entityType === "agreement" ||
    (!entityType && workflow === "contracts");

  if (
    projectContext &&
    ESTIMATE_PROJECT_CONTEXT_TOOLS.has(toolName) &&
    args.projectId === undefined
  ) {
    args.projectId = entityId;
  }

  if (
    agreementContext &&
    CONTRACT_AGREEMENT_CONTEXT_TOOLS.has(toolName) &&
    args.agreementId === undefined
  ) {
    args.agreementId = entityId;
  }

  return args;
}


