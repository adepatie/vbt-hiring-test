import { z } from "zod";

import { callProviderLLM } from "../providerClient";
import type {
  ArtifactSummaryInput,
  BusinessCaseRequestInput,
  GetProjectDetailsInput,
  McpCreateRoleRequest,
  McpLLMResponse,
  McpUpdateRoleRequest,
  QuoteTermsRequestInput,
  RequirementsRequestInput,
  SolutionRequestInput,
  WbsGenerationRequestInput,
} from "../types";
import { CopilotLLMMessage } from "../../copilot/types";
import { CopilotLLMError } from "../../copilot/errors";
import { buildArtifactContext } from "../../copilot/context/estimates";
import { buildBusinessCasePrompt } from "../../copilot/prompts/estimates";
import {
  PROMPT_SUMMARY_INSTRUCTIONS,
  STORAGE_SUMMARY_INSTRUCTIONS,
  buildArtifactSummaryPrompt,
} from "../../copilot/prompts/artifactSummaries";
import { buildRequirementsPrompt } from "../../copilot/prompts/requirements";
import { buildSolutionArchitecturePrompt } from "../../copilot/prompts/solution";
import { buildWbsPrompt } from "../../copilot/prompts/wbs";
import { buildQuoteTermsPrompt } from "../../copilot/prompts/quote";
import { estimatesService } from "../../services/estimatesService";
import { wbsItemInputSchema } from "../../zod/estimates";
import { upsertWbsItemsSchema, removeWbsItemsSchema } from "../schemas";
import { callWithContentRetry, truncateForPrompt, truncateForRequirements } from "../llmUtils";

const BUSINESS_CASE_COMPLETION_TOKENS = Number(
  process.env.LLM_MAX_OUTPUT_TOKENS ?? 1200,
);

const STORAGE_SUMMARY_MAX_TOKENS = 500;
const PROMPT_SUMMARY_MAX_TOKENS = 450;
const REQUIREMENTS_COMPLETION_TOKENS = Number(
  process.env.LLM_REQUIREMENTS_MAX_OUTPUT_TOKENS ?? 1800,
);
const REQUIREMENTS_BUSINESS_CASE_MAX_CHARS = Number(
  process.env.LLM_REQUIREMENTS_BUSINESS_CASE_MAX_CHARS ?? 6000,
);
const SOLUTION_COMPLETION_TOKENS = Number(
  process.env.LLM_SOLUTION_MAX_OUTPUT_TOKENS ?? 4000,
);
const SOLUTION_BUSINESS_CASE_MAX_CHARS = Number(
  process.env.LLM_SOLUTION_BUSINESS_CASE_MAX_CHARS ?? 6000,
);
const SOLUTION_REQUIREMENTS_MAX_CHARS = Number(
  process.env.LLM_SOLUTION_REQUIREMENTS_MAX_CHARS ?? 6000,
);
const WBS_COMPLETION_TOKENS = Number(
  process.env.LLM_EFFORT_MAX_OUTPUT_TOKENS ?? 1800,
);
const WBS_MAX_ITEMS = Number(process.env.LLM_WBS_MAX_ITEMS ?? 18);

export async function handleGetProjectDetails(
  input: GetProjectDetailsInput,
): Promise<McpLLMResponse> {
  const project = await estimatesService.getProjectWithDetails(input.projectId);
  return {
    content: JSON.stringify(project),
    raw: project,
  };
}

export async function handleSearchProjects(input: {
  query: string;
}): Promise<McpLLMResponse> {
  const projects = await estimatesService.searchProjects(input.query);
  return {
    content: JSON.stringify({ projects }),
    raw: projects,
  };
}

export async function handleUpsertWbsItems(
  input: z.infer<typeof upsertWbsItemsSchema>,
): Promise<McpLLMResponse> {
  const updatedItems = await estimatesService.upsertWbsItemsWithRoles(input);

  return {
    content: JSON.stringify({ items: updatedItems }),
    raw: updatedItems,
  };
}

export async function handleRemoveWbsItems(
  input: z.infer<typeof removeWbsItemsSchema>,
): Promise<McpLLMResponse> {
  const updatedItems = await estimatesService.removeWbsItems(input);

  return {
    content: JSON.stringify({ items: updatedItems }),
    raw: updatedItems,
  };
}

export async function handleGenerateBusinessCase(
  input: BusinessCaseRequestInput,
): Promise<McpLLMResponse> {
  const context = await buildArtifactContext(input.projectId);

  const { systemPrompt, messages } = buildBusinessCasePrompt({
    projectName: context.project.name,
    clientName: context.project.clientName,
    artifactsSummary: context.digestText,
    artifactTextSummary: context.artifactTextSummary,
    artifactTextSummaryTruncated: context.artifactTextSummaryTruncated,
  });

  const result = await callProviderLLM({
    systemPrompt,
    messages: messages as CopilotLLMMessage[],
    maxTokens: BUSINESS_CASE_COMPLETION_TOKENS,
    temperature: 0.3,
  });

  return {
    content: (result.content ?? "").trim(),
    finishReason: result.finishReason ?? null,
    raw: result.rawResponse,
  };
}

export async function handleGenerateRequirements(
  input: RequirementsRequestInput,
): Promise<McpLLMResponse> {
  const context = await buildArtifactContext(input.projectId);
  const businessCaseContent = context.project.businessCase?.content?.trim();

  if (!businessCaseContent?.length) {
    throw new CopilotLLMError(
      "Cannot generate requirements without a Business Case draft.",
      "bad_request",
    );
  }

  const { systemPrompt, messages } = buildRequirementsPrompt({
    projectName: context.project.name,
    clientName: context.project.clientName,
    artifactsSummary: context.digestText,
    businessCaseDraft: truncateForRequirements(
      businessCaseContent,
      REQUIREMENTS_BUSINESS_CASE_MAX_CHARS,
    ),
    requestedFocus: input.instructions ?? undefined,
  });

  console.log("[mcp][requirements] Prompt payload", {
    projectId: input.projectId,
    projectName: context.project.name,
    systemPrompt,
    messages,
  });

  const { content, result } = await callWithContentRetry({
    label: "requirements",
    initialTokens: REQUIREMENTS_COMPLETION_TOKENS,
    maxTokens: Math.max(REQUIREMENTS_COMPLETION_TOKENS * 2, 4000),
    callFactory: (maxTokens) =>
      callProviderLLM({
        systemPrompt,
        messages: messages as CopilotLLMMessage[],
        maxTokens,
        temperature: 0.2,
      }),
  });

  if (!content.length) {
    throw new CopilotLLMError(
      "Copilot did not return any requirements content.",
      "server",
    );
  }

  console.log("[mcp][requirements] Response", {
    projectId: input.projectId,
    finishReason: result.finishReason ?? null,
    contentPreview: content.slice(0, 500),
  });

  return {
    content,
    finishReason: result.finishReason ?? null,
    raw: result.rawResponse,
  };
}

export async function handleGenerateSolutionArchitecture(
  input: SolutionRequestInput,
): Promise<McpLLMResponse> {
  const context = await buildArtifactContext(input.projectId);
  const businessCaseContent = context.project.businessCase?.content?.trim();
  const requirementsContent = context.project.requirements?.content?.trim();

  if (!businessCaseContent?.length) {
    throw new CopilotLLMError(
      "Cannot generate Solution Architecture without a Business Case draft.",
      "bad_request",
    );
  }

  if (!requirementsContent?.length) {
    throw new CopilotLLMError(
      "Cannot generate Solution Architecture without a Requirements draft.",
      "bad_request",
    );
  }

  const businessCaseDraftForPrompt = truncateForPrompt(
    businessCaseContent,
    SOLUTION_BUSINESS_CASE_MAX_CHARS,
    "Business Case for solution prompt",
  );
  const requirementsDraftForPrompt = truncateForPrompt(
    requirementsContent,
    SOLUTION_REQUIREMENTS_MAX_CHARS,
    "Requirements for solution prompt",
  );

  const { systemPrompt, messages } = buildSolutionArchitecturePrompt({
    projectName: context.project.name,
    clientName: context.project.clientName,
    artifactsSummary: context.digestText,
    businessCaseDraft: businessCaseDraftForPrompt,
    requirementsDraft: requirementsDraftForPrompt,
    requestedFocus: input.instructions ?? undefined,
  });

  const { content, result } = await callWithContentRetry({
    label: "solution",
    initialTokens: SOLUTION_COMPLETION_TOKENS,
    maxTokens: Math.max(SOLUTION_COMPLETION_TOKENS * 2, 6000),
    callFactory: (maxTokens) =>
      callProviderLLM({
        systemPrompt,
        messages: messages as CopilotLLMMessage[],
        maxTokens,
        temperature: 0.25,
      }),
  });

  if (!content.length) {
    throw new CopilotLLMError(
      "Copilot did not return any solution architecture content.",
      "server",
    );
  }

  return {
    content,
    finishReason: result.finishReason ?? null,
    raw: result.rawResponse,
  };
}

export async function handleGenerateWbsItems(
  input: WbsGenerationRequestInput,
): Promise<McpLLMResponse> {
  const context = await buildArtifactContext(input.projectId);
  const solutionDraft = context.project.solution?.content?.trim();

  if (!solutionDraft?.length) {
    throw new CopilotLLMError(
      "Cannot generate WBS items without a Solution draft.",
      "bad_request",
    );
  }

  const roles = await estimatesService.listRoles();
  if (!roles.length) {
    throw new CopilotLLMError(
      "No delivery roles are configured. Ask Copilot to add staffing roles before generating a WBS.",
      "server",
    );
  }

  const roleCatalog = roles.map((role) => ({
    id: role.id,
    name: role.name,
    rate: role.rate,
  }));

  const { systemPrompt, messages } = buildWbsPrompt({
    projectName: context.project.name,
    clientName: context.project.clientName,
    artifactsSummary: context.digestText,
    businessCaseDraft: context.project.businessCase?.content ?? null,
    requirementsDraft: context.project.requirements?.content ?? null,
    solutionDraft,
    instructions: input.instructions ?? undefined,
    roles: roleCatalog,
  });

  const wbsToolDefinition = {
    type: "function" as const,
    function: {
      name: "generate_wbs_items",
      description:
        "Return a list of 5-18 WBS items with task, role, and hours derived from the provided context.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            minItems: 5,
            maxItems: Math.max(5, WBS_MAX_ITEMS),
            items: {
              type: "object",
              required: ["task", "roleId", "hours"],
              properties: {
                task: {
                  type: "string",
                  description:
                    "Concise description of the workstream (max 140 characters).",
                },
                roleId: {
                  type: "string",
                  description:
                    "Role id pulled from the delivery role catalog (see prompt).",
                },
                roleName: {
                  type: "string",
                  description:
                    "The human-readable role label corresponding to roleId. Repeat exactly from the role catalog.",
                },
                hours: {
                  type: "number",
                  description: "Effort estimate in hours (4-200).",
                  minimum: 4,
                  maximum: 200,
                  },
              },
            },
          },
        },
        required: ["items"],
      },
    },
  };

  const toolName = "generate_wbs_items";
  const maxTokenCeiling = Math.max(WBS_COMPLETION_TOKENS * 2, 3600);
  let tokensForCall = WBS_COMPLETION_TOKENS;
  let attempts = 0;
  let parsedPayload: unknown | null = null;
  let result = null;

  while (attempts < 3) {
    result = await callProviderLLM({
      systemPrompt,
      messages: messages as CopilotLLMMessage[],
      maxTokens: tokensForCall,
      temperature: 0.15,
      tools: [wbsToolDefinition],
      toolChoice: { type: "function", function: { name: toolName } },
    });

    try {
      parsedPayload = parseWbsToolPayload(result, toolName);
      break;
    } catch (error) {
      const finishReason = result.finishReason ?? null;
      const canRetry =
        (finishReason === "length" || finishReason === "tool_calls") &&
        tokensForCall < maxTokenCeiling;

      if (!canRetry || attempts === 2) {
        throw error;
      }

      tokensForCall = Math.min(
        Math.max(tokensForCall + Math.ceil(tokensForCall * 0.5), tokensForCall + 500),
        maxTokenCeiling,
      );
      attempts += 1;
      console.warn("[mcp][wbs] Retrying after incomplete tool output", {
        attempt: attempts,
        finishReason,
        nextTokens: tokensForCall,
      });
    }
  }

  if (!parsedPayload || !result) {
    throw new CopilotLLMError(
      "Copilot did not return structured WBS items.",
      "server",
    );
  }
  const aiWbsItemSchema = z
    .object({
      task: wbsItemInputSchema.shape.task,
      roleId: wbsItemInputSchema.shape.roleId.optional(),
      roleName: z
        .string()
        .trim()
        .min(1, "Role name is required.")
        .max(120)
        .optional(),
      hours: wbsItemInputSchema.shape.hours.max(2000),
    })
    .refine(
      (value) => Boolean(value.roleId ?? value.roleName),
      "Each WBS item must reference a roleId or roleName.",
    );
  const wbsResponseSchema = z.object({
    items: z
      .array(aiWbsItemSchema)
      .min(3)
      .max(Math.max(3, WBS_MAX_ITEMS)),
  });

  const { items } = wbsResponseSchema.parse(parsedPayload);

  return {
    content: JSON.stringify({ items }),
    finishReason: result.finishReason ?? null,
    raw: {
      toolCalls: result.toolCalls ?? null,
      llmResponse: result.rawResponse,
    },
  };
}

export async function handleSummarizeArtifact(
  input: ArtifactSummaryInput,
): Promise<McpLLMResponse> {
  const artifactLabel = input.originalName
    ? `${input.artifactType} (${input.originalName})`
    : input.artifactType;

  const instructions =
    input.mode === "storage"
      ? STORAGE_SUMMARY_INSTRUCTIONS
      : PROMPT_SUMMARY_INSTRUCTIONS;

  const maxTokens =
    input.maxTokens ??
    (input.mode === "storage"
      ? STORAGE_SUMMARY_MAX_TOKENS
      : PROMPT_SUMMARY_MAX_TOKENS);

  const { systemPrompt, messages } = buildArtifactSummaryPrompt({
    projectName: input.projectName,
    artifactLabel,
    instructions,
    rawText: input.rawText,
  });

  const result = await callProviderLLM({
    systemPrompt,
    messages: messages as CopilotLLMMessage[],
    maxTokens,
    temperature: 0.2,
  });

  return {
    content: (result.content ?? "").trim(),
    finishReason: result.finishReason ?? null,
    raw: result.rawResponse,
  };
}

export async function handleListRoles(): Promise<McpLLMResponse> {
  const roles = await estimatesService.listRoles();
  return {
    content: JSON.stringify({ roles }),
    raw: roles,
  };
}

export async function handleCreateRole(
  input: McpCreateRoleRequest["input"],
): Promise<McpLLMResponse> {
  const role = await estimatesService.createRole({
    name: input.name,
    rate: input.rate,
  });
  return {
    content: JSON.stringify({ role }),
    raw: role,
  };
}

export async function handleUpdateRole(
  input: McpUpdateRoleRequest["input"],
): Promise<McpLLMResponse> {
  const role = await estimatesService.updateRole({
    id: input.roleId,
    name: input.name,
    rate: input.rate,
  });
  return {
    content: JSON.stringify({ role }),
    raw: role,
  };
}

export async function handleGetPricingDefaults(): Promise<McpLLMResponse> {
  const defaults = await estimatesService.getPricingDefaults();
  return {
    content: JSON.stringify(defaults),
    raw: defaults,
  };
}

export async function handleUpdatePricingDefaults(
  input: { overheadFee: number },
): Promise<McpLLMResponse> {
  const updated = await estimatesService.updatePricingDefaults(input);
  return {
    content: JSON.stringify(updated),
    raw: updated,
  };
}

export async function handleGenerateQuoteTerms(
  input: QuoteTermsRequestInput,
): Promise<McpLLMResponse> {
  const project = await estimatesService.getProjectMetadata(input.projectId);
  const { systemPrompt, messages } = buildQuoteTermsPrompt({
    projectName: input.projectName,
    clientName: project.clientName,
    subtotal: input.subtotal,
    overheadFee: input.overheadFee,
    total: input.total,
    wbsSummary: input.wbsSummary,
    instructions: input.instructions ?? undefined,
  });

  const QUOTE_TERMS_COMPLETION_TOKENS = Number(
    process.env.LLM_QUOTE_TERMS_MAX_OUTPUT_TOKENS ?? 2400,
  );

  const result = await callProviderLLM({
    systemPrompt,
    messages: messages as CopilotLLMMessage[],
    maxTokens: QUOTE_TERMS_COMPLETION_TOKENS,
    temperature: 0.3,
    responseFormat: "json_object",
  });

  const content = (result.content ?? "").trim();
  if (!content.length) {
    throw new CopilotLLMError(
      "Copilot did not return any quote terms content.",
      "server",
    );
  }

  try {
    const parsed = JSON.parse(content);
    if (
      typeof parsed.paymentTerms !== "string" ||
      typeof parsed.timeline !== "string"
    ) {
      throw new Error("Invalid JSON structure");
    }
    return {
      content: JSON.stringify(parsed),
      finishReason: result.finishReason ?? null,
      raw: result.rawResponse,
    };
  } catch (error) {
    throw new CopilotLLMError(
      "Copilot returned invalid quote terms JSON.",
      "server",
    );
  }
}

function parseWbsToolPayload(
  result: any,
  functionName: string,
): unknown {
  if (Array.isArray(result?.toolCalls) && result.toolCalls.length) {
    const toolCall = result.toolCalls.find(
      (call: any) => call?.function?.name === functionName,
    );
    if (toolCall?.function?.arguments) {
      try {
        return JSON.parse(toolCall.function.arguments);
      } catch (error) {
        console.warn("[mcp][wbs] Failed to parse tool arguments", error);
      }
    }
  }

  if (result.content?.length) {
    try {
      return JSON.parse(result.content);
    } catch (error) {
      console.warn("[mcp][wbs] Failed to parse JSON content", error);
    }
  }

  throw new CopilotLLMError(
    "Copilot did not return structured WBS items.",
    "server",
  );
}
