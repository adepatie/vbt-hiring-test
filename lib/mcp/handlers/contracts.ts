import type {
  ContractCreateRequestInput,
  ContractCreateFromProjectInput,
  ContractDraftRequestInput,
  ContractReviewRequestInput,
  ContractValidationRequestInput,
  GetAgreementInput,
  ListAgreementsInput,
  McpLLMResponse,
} from "../types";
import { callProviderLLM } from "../providerClient";
import { CopilotLLMError } from "../../copilot/errors";
import { buildContractContext } from "../../copilot/context/contracts";
import {
  buildContractDraftPrompt,
  buildContractReviewPrompt,
  buildContractValidationPrompt,
} from "../../copilot/prompts/contracts";
import { contractsService } from "../../services/contractsService";
import { estimatesService } from "../../services/estimatesService";
import { generateContractDraftForAgreement } from "@/lib/server/contractGeneration";
import { callWithContentRetry } from "../llmUtils";
import { CopilotLLMMessage } from "../../copilot/types";
import { applyAcceptedProposalsToAgreement } from "@/lib/server/contractReview";

export async function handleListAgreements(
  input: ListAgreementsInput,
): Promise<McpLLMResponse> {
  const agreements = await contractsService.listAgreements(input.projectId);
  return {
    content: JSON.stringify({ agreements }),
    raw: agreements,
  };
}

export async function handleGetAgreement(
  input: GetAgreementInput,
): Promise<McpLLMResponse> {
  const agreement = await contractsService.getAgreement(input.agreementId);
  if (!agreement) {
    throw new CopilotLLMError("Agreement not found", "bad_request");
  }

  const latestVersion = await contractsService.getLatestVersion(
    input.agreementId,
  );

  // Check for empty content to give the LLM a hint
  const result = { ...agreement, latestVersion };
  if (latestVersion && !latestVersion.content) {
    (result as any)._hint =
      "The latest version of this agreement is empty. No text has been generated or saved yet.";
  }

  return {
    content: JSON.stringify(result),
    raw: result,
  };
}

export async function handleCreateAgreement(
  input: ContractCreateRequestInput,
): Promise<McpLLMResponse> {
  const agreement = await contractsService.createAgreement({
    type: input.type,
    counterparty: input.counterparty,
    projectId: input.projectId,
  });
  return {
    content: JSON.stringify(agreement),
    raw: agreement,
  };
}

export async function handleCreateAgreementsFromProject(
  input: ContractCreateFromProjectInput,
): Promise<McpLLMResponse> {
  const project = await estimatesService.getProjectMetadata(input.projectId);
  if (!project) {
    throw new CopilotLLMError("Project not found", "bad_request");
  }

  const counterparty =
    input.counterparty ?? project.clientName ?? `${project.name} Client`;

  const created: Array<{
    type: string;
    agreementId: string;
    error?: string;
  }> = [];

  for (const type of input.agreementTypes) {
    const agreement = await contractsService.createAgreement({
      type,
      counterparty,
      projectId: input.projectId,
    });

    const generation = await generateContractDraftForAgreement({
      agreementId: agreement.id,
      instructions: input.instructions ?? undefined,
      excludedPolicyIds: input.excludedPolicyIds,
      options: {
        runAutoReview: input.runAutoReview ?? type === "SOW",
      },
    });

    created.push({
      type,
      agreementId: agreement.id,
      error: generation.success ? undefined : generation.error,
    });
  }

  return {
    content: JSON.stringify({ agreements: created }),
    raw: created,
  };
}

export async function handleGenerateContractDraft(
  input: ContractDraftRequestInput,
): Promise<McpLLMResponse> {
  const context = await buildContractContext(
    input.agreementId,
    undefined,
    input.excludedPolicyIds,
  );

  if (!context.agreement) {
    throw new CopilotLLMError("Agreement not found", "bad_request");
  }

  const { systemPrompt, messages } = buildContractDraftPrompt({
    agreementType: context.agreement.type,
    counterparty: context.agreement.counterparty,
    digestText: context.digestText,
    instructions: input.instructions ?? undefined,
  });

  const { content, result } = await callWithContentRetry({
    label: "contract-draft",
    initialTokens: 5000,
    maxTokens: 12000,
    callFactory: (maxTokens) =>
      callProviderLLM({
        systemPrompt,
        messages: messages as CopilotLLMMessage[],
        maxTokens,
        temperature: 0.3,
      }),
  });

  return {
    content,
    finishReason: result.finishReason ?? null,
    raw: result.rawResponse,
  };
}

export async function handleReviewContractDraft(
  input: ContractReviewRequestInput,
): Promise<McpLLMResponse> {
  const context = await buildContractContext(
    input.agreementId,
    input.agreementType,
    input.excludedPolicyIds,
  );

  const { systemPrompt, messages } = buildContractReviewPrompt({
    agreementType:
      context.agreement?.type ?? input.agreementType ?? "Contract",
    digestText: context.digestText,
    incomingDraft: input.incomingDraft,
  });

  const { content, result } = await callWithContentRetry({
    label: "contract-review",
    initialTokens: 6000,
    maxTokens: 12000,
    callFactory: (maxTokens) =>
      callProviderLLM({
        systemPrompt,
        messages: messages as CopilotLLMMessage[],
        maxTokens,
        temperature: 0.2,
        responseFormat: "json_object",
      }),
  });

  return {
    content,
    finishReason: result.finishReason ?? null,
    raw: result.rawResponse,
  };
}

export async function handleValidateContract(
  input: ContractValidationRequestInput,
): Promise<McpLLMResponse> {
  const context = await buildContractContext(input.agreementId);

  if (!context.agreement) {
    throw new CopilotLLMError("Agreement not found", "bad_request");
  }

  const latestVersion = await contractsService.getLatestVersion(
    input.agreementId,
  );
  if (!latestVersion || !latestVersion.content) {
    throw new CopilotLLMError(
      "Agreement has no content to validate.",
      "bad_request",
    );
  }

  const { systemPrompt, messages } = buildContractValidationPrompt({
    agreementType: context.agreement.type,
    digestText: context.digestText,
    currentContent: latestVersion.content,
  });

  const { content, result } = await callWithContentRetry({
    label: "contract-validate",
    initialTokens: 6000,
    maxTokens: 8000,
    callFactory: (maxTokens) =>
      callProviderLLM({
        systemPrompt,
        messages: messages as CopilotLLMMessage[],
        maxTokens,
        temperature: 0.1,
        responseFormat: "json_object",
      }),
  });

  return {
    content,
    finishReason: result.finishReason ?? null,
    raw: result.rawResponse,
  };
}

export async function handleCreateContractVersion(input: {
  agreementId: string;
  content: string;
  changeNote?: string;
}): Promise<McpLLMResponse> {
  const version = await contractsService.createVersion({
    agreementId: input.agreementId,
    content: input.content,
    changeNote: input.changeNote,
  });
  return {
    content: JSON.stringify(version),
    raw: version,
  };
}

export async function handleUpdateContractNotes(input: {
  agreementId: string;
  notes: string;
}): Promise<McpLLMResponse> {
  const agreement = await contractsService.updateAgreementNotes(
    input.agreementId,
    input.notes,
  );
  if (!agreement) {
    throw new CopilotLLMError("Agreement not found", "bad_request");
  }
  return {
    content: JSON.stringify(agreement),
    raw: agreement,
  };
}

export async function handleApplyContractProposals(input: {
  agreementId: string;
  decisions?: Record<string, "accepted" | "rejected" | "pending">;
  changeNote?: string;
  markApproved?: boolean;
}): Promise<McpLLMResponse> {
  const result = await applyAcceptedProposalsToAgreement({
    agreementId: input.agreementId,
    decisions: input.decisions,
    changeNote: input.changeNote,
    markApproved: input.markApproved,
  });

  return {
    content: JSON.stringify({
      agreementId: result.agreementId,
      versionId: result.version.id,
      acceptedCount: result.acceptedCount,
      changeNote: result.changeNote,
    }),
    raw: result,
  };
}
