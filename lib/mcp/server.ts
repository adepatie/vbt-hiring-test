import { z } from "zod";

import type {
  ArtifactSummaryInput,
  BusinessCaseRequestInput,
  ContractCreateRequestInput,
  ContractCreateFromProjectInput,
  ContractDraftRequestInput,
  ContractReviewRequestInput,
  ContractValidationRequestInput,
  GetAgreementInput,
  GetProjectDetailsInput,
  ListAgreementsInput,
  McpChatRequest,
  McpCreateRoleRequest,
  McpLLMResponse,
  McpRequest,
  McpResponse,
  McpToolName,
  McpUpdateRoleRequest,
  QuoteTermsRequestInput,
  RequirementsRequestInput,
  SolutionRequestInput,
  WbsGenerationRequestInput,
} from "./types";
import { callProviderLLM } from "./providerClient";
import { CopilotLLMError } from "../copilot/errors";
import { toErrorResponse, toSuccessResponse } from "./errorHelpers";
import { MCP_TOOLS } from "./registry";
import {
  handleCreateAgreement,
  handleCreateAgreementsFromProject,
  handleGenerateContractDraft,
  handleGetAgreement,
  handleListAgreements,
  handleReviewContractDraft,
  handleValidateContract,
  handleCreateContractVersion,
  handleUpdateContractNotes,
  handleApplyContractProposals,
} from "./handlers/contracts";
import {
  handleCreateRole,
  handleGenerateBusinessCase,
  handleGenerateQuoteTerms,
  handleGenerateRequirements,
  handleGenerateSolutionArchitecture,
  handleGenerateWbsItems,
  handleGetPricingDefaults,
  handleGetProjectDetails,
  handleListRoles,
  handleSummarizeArtifact,
  handleUpdatePricingDefaults,
  handleUpdateRole,
  handleSearchProjects,
  handleUpsertWbsItems,
  handleRemoveWbsItems,
} from "./handlers/estimates";

export class McpLLMServer {
  async handle(
    request: McpRequest & { tool: McpToolName },
  ): Promise<McpResponse> {
    try {
      // Handle special built-in chat tool directly
      if (request.tool === "llm.chat") {
        return toSuccessResponse(
          request.requestId,
          await this.handleChat((request as McpChatRequest).input),
        );
      }

      const toolDef = MCP_TOOLS[request.tool];
      if (!toolDef) {
        throw new CopilotLLMError(
          `Unknown MCP tool: ${request.tool}`,
          "bad_request",
        );
      }

      // Validate input against the registry schema
      const validatedInput = toolDef.schema.parse(request.input);

      // Execute tool handler
      const result = await toolDef.execute(validatedInput);
      
      return toSuccessResponse(request.requestId, result);

    } catch (error) {
      if (error instanceof z.ZodError) {
        return toErrorResponse(request.requestId, {
          kind: "bad_request",
          message: "Invalid tool input arguments.",
          detail: error.issues,
        } as any);
      }
      return toErrorResponse(request.requestId, error);
    }
  }

  private async handleChat(
    input: McpChatRequest["input"],
  ): Promise<McpLLMResponse> {
    const result = await callProviderLLM({
      systemPrompt: input.systemPrompt,
      messages: input.messages,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
      responseFormat: input.responseFormat ?? "text",
      tools: input.tools,
      toolChoice: input.toolChoice,
    });

    return {
      content: (result.content ?? "").trim(),
      finishReason: result.finishReason ?? null,
      raw: result.rawResponse,
    };
  }

  // --- Read Tools Handlers ---

  async handleGetProjectDetails(
    input: GetProjectDetailsInput,
  ): Promise<McpLLMResponse> {
    return handleGetProjectDetails(input);
  }

  async handleSearchProjects(input: { query: string }): Promise<McpLLMResponse> {
    return handleSearchProjects(input);
  }

  async handleListAgreements(
    input: ListAgreementsInput,
  ): Promise<McpLLMResponse> {
    return handleListAgreements(input);
  }

  async handleGetAgreement(
    input: GetAgreementInput,
  ): Promise<McpLLMResponse> {
    return handleGetAgreement(input);
  }

  // --- Generation Handlers (Public for Registry) ---

  async handleGenerateBusinessCase(
    input: BusinessCaseRequestInput,
  ): Promise<McpLLMResponse> {
    return handleGenerateBusinessCase(input);
  }

  async handleGenerateRequirements(
    input: RequirementsRequestInput,
  ): Promise<McpLLMResponse> {
    return handleGenerateRequirements(input);
  }

  async handleGenerateSolutionArchitecture(
    input: SolutionRequestInput,
  ): Promise<McpLLMResponse> {
    return handleGenerateSolutionArchitecture(input);
  }

  async handleGenerateWbsItems(
    input: WbsGenerationRequestInput,
  ): Promise<McpLLMResponse> {
    return handleGenerateWbsItems(input);
  }

  async handleUpsertWbsItems(input: any): Promise<McpLLMResponse> {
    return handleUpsertWbsItems(input);
  }

  async handleRemoveWbsItems(input: any): Promise<McpLLMResponse> {
    return handleRemoveWbsItems(input);
  }

  async handleListRoles(): Promise<McpLLMResponse> {
    return handleListRoles();
  }

  async handleCreateRole(
    input: McpCreateRoleRequest["input"],
  ): Promise<McpLLMResponse> {
    return handleCreateRole(input);
  }

  async handleUpdateRole(
    input: McpUpdateRoleRequest["input"],
  ): Promise<McpLLMResponse> {
    return handleUpdateRole(input);
  }

  async handleSummarizeArtifact(
    input: ArtifactSummaryInput,
  ): Promise<McpLLMResponse> {
    return handleSummarizeArtifact(input);
  }

  async handleGetPricingDefaults(): Promise<McpLLMResponse> {
    return handleGetPricingDefaults();
  }

  async handleUpdatePricingDefaults(input: {
    overheadFee: number;
  }): Promise<McpLLMResponse> {
    return handleUpdatePricingDefaults(input);
  }

  async handleGenerateQuoteTerms(
    input: QuoteTermsRequestInput,
  ): Promise<McpLLMResponse> {
    return handleGenerateQuoteTerms(input);
  }

  async handleCreateAgreement(
    input: ContractCreateRequestInput,
  ): Promise<McpLLMResponse> {
    return handleCreateAgreement(input);
  }

  async handleCreateAgreementsFromProject(
    input: ContractCreateFromProjectInput,
  ): Promise<McpLLMResponse> {
    return handleCreateAgreementsFromProject(input);
  }

  async handleGenerateContractDraft(
    input: ContractDraftRequestInput,
  ): Promise<McpLLMResponse> {
    return handleGenerateContractDraft(input);
  }

  async handleReviewContractDraft(
    input: ContractReviewRequestInput,
  ): Promise<McpLLMResponse> {
    return handleReviewContractDraft(input);
  }

  async handleValidateContract(
    input: ContractValidationRequestInput,
  ): Promise<McpLLMResponse> {
    return handleValidateContract(input);
  }

  async handleCreateContractVersion(input: {
    agreementId: string;
    content: string;
    changeNote?: string;
  }): Promise<McpLLMResponse> {
    return handleCreateContractVersion(input);
  }

  async handleUpdateContractNotes(input: {
    agreementId: string;
    notes: string;
  }): Promise<McpLLMResponse> {
    return handleUpdateContractNotes(input);
  }

  async handleApplyContractProposals(input: {
    agreementId: string;
    decisions?: Record<string, "accepted" | "rejected" | "pending">;
    changeNote?: string;
    markApproved?: boolean;
  }): Promise<McpLLMResponse> {
    return handleApplyContractProposals(input);
  }
}

export const mcpLLMServer = new McpLLMServer();
