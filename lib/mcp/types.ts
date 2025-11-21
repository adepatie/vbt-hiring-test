import type { CopilotLLMMessage, CopilotToolDefinition, CopilotToolChoice } from "../copilot/types";

export type McpToolName =
  | "llm.chat"
  | "estimates.generateBusinessCaseFromArtifacts"
  | "estimates.generateRequirementsSummary"
  | "estimates.generateSolutionArchitecture"
  | "estimates.generateWbsItems"
  | "estimates.upsertWbsItems"
  | "estimates.removeWbsItems"
  | "estimates.summarizeArtifact"
  | "estimates.getProjectDetails"
  | "roles.list"
  | "roles.create"
  | "roles.update"
  | "quote.getPricingDefaults"
  | "quote.updatePricingDefaults"
  | "quote.generateTerms"
  | "contracts.create"
  | "contracts.createFromProject"
  | "contracts.generateDraft"
  | "contracts.reviewDraft"
  | "contracts.validateAnalysis"
  | "contracts.listAgreements"
  | "contracts.getAgreement"
  | "contracts.createVersion"
  | "contracts.updateNotes"
  | "contracts.applyProposals";

export interface McpBaseRequest {
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface McpChatRequest extends McpBaseRequest {
  tool: "llm.chat";
  input: {
    systemPrompt?: string;
    messages: CopilotLLMMessage[];
    maxTokens?: number;
    temperature?: number;
    responseFormat?: "text" | "json_object";
    tools?: CopilotToolDefinition[];
    toolChoice?: CopilotToolChoice;
  };
}

export interface BusinessCaseRequestInput {
  projectId: string;
  projectName: string;
  instructions?: string | null;
}

export interface McpGenerateBusinessCaseRequest extends McpBaseRequest {
  tool: "estimates.generateBusinessCaseFromArtifacts";
  input: BusinessCaseRequestInput;
}

export interface RequirementsRequestInput {
  projectId: string;
  projectName: string;
  instructions?: string | null;
}

export interface McpGenerateRequirementsRequest extends McpBaseRequest {
  tool: "estimates.generateRequirementsSummary";
  input: RequirementsRequestInput;
}

export interface SolutionRequestInput {
  projectId: string;
  projectName: string;
  instructions?: string | null;
}

export interface McpGenerateSolutionRequest extends McpBaseRequest {
  tool: "estimates.generateSolutionArchitecture";
  input: SolutionRequestInput;
}

export interface WbsGenerationRequestInput {
  projectId: string;
  projectName: string;
  instructions?: string | null;
}

export interface McpGenerateWbsRequest extends McpBaseRequest {
  tool: "estimates.generateWbsItems";
  input: WbsGenerationRequestInput;
}

export interface McpListRolesRequest extends McpBaseRequest {
  tool: "roles.list";
  input?: Record<string, never>;
}

export interface McpCreateRoleRequest extends McpBaseRequest {
  tool: "roles.create";
  input: {
    name: string;
    rate: number;
  };
}

export interface McpUpdateRoleRequest extends McpBaseRequest {
  tool: "roles.update";
  input: {
    roleId: string;
    name?: string;
    rate?: number;
  };
}

export interface McpGetPricingDefaultsRequest extends McpBaseRequest {
  tool: "quote.getPricingDefaults";
  input?: Record<string, never>;
}

export interface McpUpdatePricingDefaultsRequest extends McpBaseRequest {
  tool: "quote.updatePricingDefaults";
  input: {
    overheadFee: number;
  };
}

export interface QuoteTermsRequestInput {
  projectId: string;
  projectName: string;
  subtotal: number;
  overheadFee: number;
  total: number;
  wbsSummary: string;
  instructions?: string | null;
}

export interface McpGenerateQuoteTermsRequest extends McpBaseRequest {
  tool: "quote.generateTerms";
  input: QuoteTermsRequestInput;
}

export type ArtifactSummaryMode = "storage" | "prompt";

export interface ArtifactSummaryInput {
  projectId: string;
  projectName: string;
  artifactId: string;
  artifactType: string;
  originalName?: string | null;
  rawText: string;
  mode: ArtifactSummaryMode;
  maxTokens?: number;
}

export interface McpSummarizeArtifactRequest extends McpBaseRequest {
  tool: "estimates.summarizeArtifact";
  input: ArtifactSummaryInput;
}

// --- Read Tools ---

export interface GetProjectDetailsInput {
  projectId: string;
}

export interface McpGetProjectDetailsRequest extends McpBaseRequest {
  tool: "estimates.getProjectDetails";
  input: GetProjectDetailsInput;
}

export interface ListAgreementsInput {
  projectId: string;
}

export interface McpListAgreementsRequest extends McpBaseRequest {
  tool: "contracts.listAgreements";
  input: ListAgreementsInput;
}

export interface GetAgreementInput {
  agreementId: string;
}

export interface McpGetAgreementRequest extends McpBaseRequest {
  tool: "contracts.getAgreement";
  input: GetAgreementInput;
}

// --- Contracts Tools ---

export interface ContractCreateRequestInput {
  type: "MSA" | "SOW";
  counterparty: string;
  projectId?: string;
  instructions?: string | null;
}

export interface McpCreateContractRequest extends McpBaseRequest {
  tool: "contracts.create";
  input: ContractCreateRequestInput;
}

export interface ContractCreateFromProjectInput {
  projectId: string;
  agreementTypes: ("MSA" | "SOW")[];
  counterparty?: string;
  instructions?: string | null;
  excludedPolicyIds?: string[];
  runAutoReview?: boolean;
}

export interface McpCreateContractFromProjectRequest extends McpBaseRequest {
  tool: "contracts.createFromProject";
  input: ContractCreateFromProjectInput;
}

export interface ContractDraftRequestInput {
  agreementId: string;
  instructions?: string | null;
  excludedPolicyIds?: string[];
}

export interface McpGenerateContractDraftRequest extends McpBaseRequest {
  tool: "contracts.generateDraft";
  input: ContractDraftRequestInput;
}

export interface ContractReviewRequestInput {
  agreementId?: string;
  agreementType?: string;
  incomingDraft: string;
  excludedPolicyIds?: string[];
}

export interface McpReviewContractDraftRequest extends McpBaseRequest {
  tool: "contracts.reviewDraft";
  input: ContractReviewRequestInput;
}

export interface ContractValidationRequestInput {
  agreementId: string;
}

export interface McpValidateContractRequest extends McpBaseRequest {
  tool: "contracts.validateAnalysis";
  input: ContractValidationRequestInput;
}

export interface ContractApplyProposalsInput {
  agreementId: string;
  decisions?: Record<string, "accepted" | "rejected" | "pending">;
  changeNote?: string;
  markApproved?: boolean;
}

export interface McpApplyContractProposalsRequest extends McpBaseRequest {
  tool: "contracts.applyProposals";
  input: ContractApplyProposalsInput;
}

export type McpRequest =
  | McpChatRequest
  | McpGenerateBusinessCaseRequest
  | McpGenerateRequirementsRequest
  | McpGenerateSolutionRequest
  | McpGenerateWbsRequest
  | McpSummarizeArtifactRequest
  | McpListRolesRequest
  | McpCreateRoleRequest
  | McpUpdateRoleRequest
  | McpGetPricingDefaultsRequest
  | McpUpdatePricingDefaultsRequest
  | McpGenerateQuoteTermsRequest
  | McpCreateContractRequest
  | McpGenerateContractDraftRequest
  | McpReviewContractDraftRequest
  | McpValidateContractRequest
  | McpGetProjectDetailsRequest
  | McpListAgreementsRequest
  | McpGetAgreementRequest
  | McpApplyContractProposalsRequest;

export interface McpLLMResponse {
  content: string;
  finishReason?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  raw?: unknown;
}

export interface McpSuccessResponse {
  requestId?: string;
  result: McpLLMResponse;
}

export type McpErrorKind =
  | "config"
  | "auth"
  | "bad_request"
  | "rate_limit"
  | "server"
  | "connection"
  | "unknown";

export interface McpErrorResponse {
  requestId?: string;
  error: {
    kind: McpErrorKind;
    message: string;
    detail?: unknown;
    status?: number;
  };
}

export type McpResponse = McpSuccessResponse | McpErrorResponse;
