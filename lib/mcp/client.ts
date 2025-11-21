import {
  McpChatRequest,
  McpGenerateBusinessCaseRequest,
  McpSummarizeArtifactRequest,
  McpLLMResponse,
  BusinessCaseRequestInput,
  ArtifactSummaryInput,
  McpGenerateRequirementsRequest,
  RequirementsRequestInput,
  McpGenerateSolutionRequest,
  SolutionRequestInput,
  McpGenerateWbsRequest,
  WbsGenerationRequestInput,
  McpListRolesRequest,
  McpCreateRoleRequest,
  McpUpdateRoleRequest,
  McpReviewContractDraftRequest,
  ContractReviewRequestInput,
} from "./types";
import { mcpLLMServer } from "./server";
import { copilotErrorFromPayload } from "./errorHelpers";

async function invokeMcp<T extends { tool: string }>(
  request: T,
): Promise<McpLLMResponse> {
  const response = await mcpLLMServer.handle(request);

  if ("error" in response) {
    throw copilotErrorFromPayload(response.error);
  }

  return response.result;
}

export async function mcpChat(
  input: McpChatRequest["input"],
): Promise<McpLLMResponse> {
  return invokeMcp<McpChatRequest>({
    tool: "llm.chat",
    input,
  });
}

export async function mcpGenerateBusinessCaseFromArtifacts(
  input: BusinessCaseRequestInput,
): Promise<McpLLMResponse> {
  return invokeMcp<McpGenerateBusinessCaseRequest>({
    tool: "estimates.generateBusinessCaseFromArtifacts",
    input,
  });
}

export async function mcpGenerateRequirementsSummary(
  input: RequirementsRequestInput,
): Promise<McpLLMResponse> {
  return invokeMcp<McpGenerateRequirementsRequest>({
    tool: "estimates.generateRequirementsSummary",
    input,
  });
}

export async function mcpGenerateSolutionArchitecture(
  input: SolutionRequestInput,
): Promise<McpLLMResponse> {
  return invokeMcp<McpGenerateSolutionRequest>({
    tool: "estimates.generateSolutionArchitecture",
    input,
  });
}

export async function mcpSummarizeArtifact(
  input: ArtifactSummaryInput,
): Promise<McpLLMResponse> {
  return invokeMcp<McpSummarizeArtifactRequest>({
    tool: "estimates.summarizeArtifact",
    input,
  });
}

export async function mcpGenerateWbsItems(
  input: WbsGenerationRequestInput,
): Promise<McpLLMResponse> {
  return invokeMcp<McpGenerateWbsRequest>({
    tool: "estimates.generateWbsItems",
    input,
  });
}

export async function mcpGetPricingDefaults(): Promise<McpLLMResponse> {
  return invokeMcp<McpGetPricingDefaultsRequest>({
    tool: "quote.getPricingDefaults",
    input: {},
  });
}

export async function mcpUpdatePricingDefaults(input: {
  overheadFee: number;
}): Promise<McpLLMResponse> {
  return invokeMcp<McpUpdatePricingDefaultsRequest>({
    tool: "quote.updatePricingDefaults",
    input,
  });
}

export async function mcpGenerateQuoteTerms(
  input: QuoteTermsRequestInput,
): Promise<McpLLMResponse> {
  return invokeMcp<McpGenerateQuoteTermsRequest>({
    tool: "quote.generateTerms",
    input,
  });
}

export async function mcpListRoles(): Promise<McpLLMResponse> {
  return invokeMcp<McpListRolesRequest>({
    tool: "roles.list",
    input: {},
  });
}

export async function mcpCreateRole(
  input: McpCreateRoleRequest["input"],
): Promise<McpLLMResponse> {
  return invokeMcp<McpCreateRoleRequest>({
    tool: "roles.create",
    input,
  });
}

export async function mcpUpdateRole(
  input: McpUpdateRoleRequest["input"],
): Promise<McpLLMResponse> {
  return invokeMcp<McpUpdateRoleRequest>({
    tool: "roles.update",
    input,
  });
}

export async function mcpReviewContractDraft(
  input: ContractReviewRequestInput,
): Promise<McpLLMResponse> {
  return invokeMcp<McpReviewContractDraftRequest>({
    tool: "contracts.reviewDraft",
    input,
  });
}
