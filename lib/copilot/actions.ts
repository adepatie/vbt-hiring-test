import { z } from "zod";

import {
  generateBusinessCaseFromArtifactsInputSchema,
  generateRequirementsFromBusinessCaseInputSchema,
  generateSolutionFromRequirementsInputSchema,
  generateEffortFromSolutionInputSchema,
  wbsItemInputSchema,
  type EstimateStage,
} from "../zod/estimates";
import { CopilotLLMError } from "./errors";
import { estimatesService } from "../services/estimatesService";
import {
  mcpGenerateBusinessCaseFromArtifacts,
  mcpGenerateRequirementsSummary,
  mcpChat,
  mcpGenerateSolutionArchitecture,
  mcpGenerateWbsItems,
  mcpGenerateQuoteTerms,
  mcpReviewContractDraft,
} from "../mcp/client";
import { getOpenAiTools, getOpenAiToolNameMap } from "../mcp/registry";
import { contractsService } from "../services/contractsService";
import type {
  CopilotLLMMessage,
  CopilotToolStatusMeta,
  CopilotWorkflow,
} from "./types";
import {
  executeToolCalls,
  filterToolsByAllowlist,
  getAllowedToolSetForContext,
  summarizeToolExecutions,
  type ToolExecutionRecord,
} from "./helpers";
import { buildHistoryWindow } from "./history-utils";

const generateBusinessCaseInputZod = generateBusinessCaseFromArtifactsInputSchema;
const generateRequirementsInputZod =
  generateRequirementsFromBusinessCaseInputSchema;
const generateSolutionInputZod = generateSolutionFromRequirementsInputSchema;
const generateEffortInputZod = generateEffortFromSolutionInputSchema;

// --- Chat Action ---

const chatInputSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant", "tool"]),
      content: z.union([z.string(), z.null()]).optional(),
      name: z.string().optional(),
      tool_call_id: z.string().optional(),
      tool_calls: z.array(z.unknown()).optional(),
    })
  ),
  workflow: z.enum(["estimates", "contracts"]).optional(),
  entityId: z.string().optional(),
  entityType: z.enum(["project", "agreement"]).optional(),
  view: z.string().optional(),
});

function buildAssistantSummaryFromMetas(
  metas: CopilotToolStatusMeta[],
  defaultSummary: string,
) {
  if (!metas.length) {
    return defaultSummary || "";
  }

  const blocking = metas.find((meta) => meta.status !== "success");
  if (blocking) {
    return blocking.summary;
  }

  if (defaultSummary.length) {
    return defaultSummary;
  }

  if (metas.length === 1) {
    return metas[0]?.summary ?? "";
  }

  const labels = metas.map((meta) => meta.label);
  return `Completed ${labels.length} action${labels.length > 1 ? "s" : ""}: ${labels.join(", ")}.`;
}

const MAX_AGENT_TURNS = 5;
const HISTORY_WINDOW_SIZE = 20;
const CHAT_COMPLETION_MAX_TOKENS =
  Number(process.env.COPILOT_CHAT_COMPLETION_MAX_TOKENS ?? 2000);

async function chatRun(input: unknown) {
  const parsed = chatInputSchema.parse(input);

  const workflow = parsed.workflow as CopilotWorkflow | undefined;
  const entityType = parsed.entityType;
  let projectContext:
    | {
        stage: EstimateStage;
        hasApprovedAgreement: boolean;
        isReadOnly: boolean;
      }
    | null = null;

  if (workflow === "estimates" && parsed.entityId) {
    try {
      projectContext = await estimatesService.getProjectLockContext(
        parsed.entityId,
      );
    } catch (error) {
      console.warn(
        `[Copilot] Failed to load project context for ${parsed.entityId}`,
        error,
      );
    }
  }

  const isHardReadOnly =
    Boolean(projectContext?.isReadOnly) && workflow !== "estimates";
  const openAiToolNameMap = getOpenAiToolNameMap(); // OpenAI-safe -> internal MCP name
  const allowedToolSet = getAllowedToolSetForContext(workflow, {
    readOnly: isHardReadOnly,
  });
  const tools = filterToolsByAllowlist(
    getOpenAiTools(),
    openAiToolNameMap,
    allowedToolSet,
  );

  const contextLines = [
    `Workflow: ${workflow ?? "General"}`,
    `Entity ID: ${parsed.entityId ?? "None"}`,
    `Entity Type: ${entityType ?? "Unknown"}`,
    `View: ${parsed.view ?? "None"}`,
  ];

  if (projectContext) {
    contextLines.push(`Project Stage: ${projectContext.stage}`);
    contextLines.push(
      projectContext.hasApprovedAgreement
        ? "Agreements: Approved contract linked (read-only)."
        : "Agreements: No approved contract linked.",
    );
  }

  const readOnlyInstruction = isHardReadOnly
    ? "\n- READ-ONLY MODE: The linked project is locked. Do not call tools that mutate data; provide explanations or read-only lookups instead."
    : "";

  // 1. Meta System Prompt
  const META_SYSTEM_PROMPT = `You are VBT's Copilot, a senior consulting assistant.
Your goal is to help users with Estimates (Business Case, Requirements, Solution, WBS, Quote) and Contracts.

CRITICAL INSTRUCTIONS:
- You have access to powerful tools for reading and writing data.
- PREFER calling tools over purely text-based reasoning when dealing with domain data (e.g., "generate a WBS", "create a role", "update overhead").
- When asked to generate content (Business Case, Requirements, etc.), ALWAYS use the specific \`estimates.generate...\` tools. Do not write the content yourself.
- For WBS items, use \`estimates.generateWbsItems\`.
- For Quotes, use \`quote.generateTerms\` or \`quote.updatePricingDefaults\`.
- For Contracts, use \`contracts.create\`, \`contracts.createFromProject\`, \`contracts.generateDraft\`, etc.
- If the user asks a question about the project, use \`estimates.getProjectDetails\` first.
- If the user asks about roles, use \`roles.list\`.
${readOnlyInstruction}
- Keep user-facing responses concise (one or two sentences) and avoid repeating tool log details.

Context:
${contextLines.join("\n")}
`;

  const history = [...(parsed.messages as CopilotLLMMessage[])];
  let shouldRefresh = false;
  let lastExecutionSummaries: ToolExecutionRecord[] = [];
  let lastToolMetas: CopilotToolStatusMeta[] = [];

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn += 1) {
    const truncatedHistory = buildHistoryWindow(
      history,
      HISTORY_WINDOW_SIZE,
    );

    const llmResponse = await mcpChat({
      systemPrompt: META_SYSTEM_PROMPT,
      messages: truncatedHistory as CopilotLLMMessage[],
      tools,
      toolChoice: "auto",
      maxTokens: CHAT_COMPLETION_MAX_TOKENS,
    });

    const assistantText = (llmResponse.content ?? "").trim();
    const toolCalls =
      llmResponse.raw && typeof llmResponse.raw === "object"
        ? (llmResponse.raw as any).choices?.[0]?.message?.tool_calls
        : undefined;

    if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
      if (assistantText.length) {
        history.push({
          role: "assistant",
          content: assistantText,
        });
        return {
          messages: history,
          shouldRefresh,
        };
      }

      break;
    }

    const assistantToolMessage: CopilotLLMMessage = {
      role: "assistant",
      content: assistantText || null,
      tool_calls: toolCalls,
    };

    history.push(assistantToolMessage);

    const {
      toolMessages,
      sideEffectMessages,
      executionSummaries,
      shouldRefresh: turnRefresh,
    } = await executeToolCalls({
      toolCalls,
      openAiToolNameMap,
      allowedToolSet,
      workflow,
      entityId: parsed.entityId,
      entityType: entityType as "project" | "agreement" | undefined,
      projectStage: projectContext?.stage,
    });

    history.push(...toolMessages, ...sideEffectMessages);
    shouldRefresh = shouldRefresh || turnRefresh;
    lastExecutionSummaries = executionSummaries;
    lastToolMetas = toolMessages
      .map((message) => message.meta)
      .filter((meta): meta is CopilotToolStatusMeta => Boolean(meta));

    const allBlockedOrErrored =
      lastToolMetas.length > 0 &&
      lastToolMetas.every((meta) => meta.status !== "success");
    if (allBlockedOrErrored) {
      break;
    }
  }

  const summaryText = summarizeToolExecutions(lastExecutionSummaries).trim();
  const fallbackAssistantText = buildAssistantSummaryFromMetas(
    lastToolMetas,
    summaryText,
  );

  if (
    lastToolMetas.length > 0 &&
    lastToolMetas.some((meta) => meta.status !== "success")
  ) {
    if (fallbackAssistantText.length) {
      history.push({
        role: "assistant",
        content: fallbackAssistantText,
      });
    }

    return {
      messages: history,
      shouldRefresh,
    };
  }

  const followUpHistory = buildHistoryWindow(
    history,
    HISTORY_WINDOW_SIZE,
  );

  const finalTurnResponse = await mcpChat({
    systemPrompt: META_SYSTEM_PROMPT,
    messages: followUpHistory,
    tools,
    toolChoice: "none",
    maxTokens: CHAT_COMPLETION_MAX_TOKENS,
  });

  const finalText = (finalTurnResponse.content ?? "").trim();
  if (finalText.length) {
    history.push({
      role: "assistant",
      content: finalText,
    });
  } else if (fallbackAssistantText.length) {
    history.push({
      role: "assistant",
      content: fallbackAssistantText,
    });
  } else {
    history.push({
      role: "assistant",
      content:
        "I’ve completed the requested operations, but no further details were provided.",
    });
  }

  return {
    messages: history,
    shouldRefresh,
  };
}


async function generateBusinessCaseFromArtifacts(
  input: unknown,
) {
  const parsed = generateBusinessCaseInputZod.parse(input);

  try {
    const metadata = await estimatesService.getProjectMetadata(parsed.projectId);

    const result = await mcpGenerateBusinessCaseFromArtifacts({
      projectId: metadata.id,
      projectName: metadata.name,
      instructions: parsed.instructions,
    });

    const draftContent = (result.content ?? "").trim();
    if (!draftContent.length) {
      throw new CopilotLLMError(
        "Copilot did not return any business case content.",
        "server",
      );
    }

    const saved = await estimatesService.saveStageContent({
      projectId: parsed.projectId,
      stage: "BUSINESS_CASE",
      content: draftContent,
      approved: false,
    });

    return {
      kind: "business_case_draft" as const,
      projectId: parsed.projectId,
      stage: "BUSINESS_CASE" as const,
      draft: draftContent,
      record: saved,
    };
  } catch (error) {
    if (error instanceof CopilotLLMError) {
      throw error;
    }
    throw new CopilotLLMError(
      error instanceof Error ? error.message : "Failed to generate business case.",
      "unknown",
    );
  }
}

async function generateRequirementsFromBusinessCase(
  input: unknown,
) {
  const parsed = generateRequirementsInputZod.parse(input);

  try {
    const metadata = await estimatesService.getProjectMetadata(parsed.projectId);

    const result = await mcpGenerateRequirementsSummary({
      projectId: metadata.id,
      projectName: metadata.name,
      instructions: parsed.instructions,
    });

    const draftContent = (result.content ?? "").trim();
    if (!draftContent.length) {
      throw new CopilotLLMError(
        "Copilot did not return any requirements content.",
        "server",
      );
    }

    const saved = await estimatesService.saveStageContent({
      projectId: parsed.projectId,
      stage: "REQUIREMENTS",
      content: draftContent,
      approved: false,
    });

    return {
      kind: "requirements_draft" as const,
      projectId: parsed.projectId,
      stage: "REQUIREMENTS" as const,
      draft: draftContent,
      record: saved,
    };
  } catch (error) {
    if (error instanceof CopilotLLMError) {
      throw error;
    }
    throw new CopilotLLMError(
      error instanceof Error ? error.message : "Failed to generate requirements.",
      "unknown",
    );
  }
}

async function generateSolutionArchitectureFromRequirements(
  input: unknown,
) {
  const parsed = generateSolutionInputZod.parse(input);

  try {
    const metadata = await estimatesService.getProjectMetadata(parsed.projectId);

    const result = await mcpGenerateSolutionArchitecture({
      projectId: metadata.id,
      projectName: metadata.name,
      instructions: parsed.instructions,
    });

    const draftContent = (result.content ?? "").trim();
    if (!draftContent.length) {
      throw new CopilotLLMError(
        "Copilot did not return any solution architecture content.",
        "server",
      );
    }

    const saved = await estimatesService.saveStageContent({
      projectId: parsed.projectId,
      stage: "SOLUTION",
      content: draftContent,
      approved: false,
    });

    return {
      kind: "solution_architecture_draft" as const,
      projectId: parsed.projectId,
      stage: "SOLUTION" as const,
      draft: draftContent,
      record: saved,
    };
  } catch (error) {
    if (error instanceof CopilotLLMError) {
      throw error;
    }
    throw new CopilotLLMError(
      error instanceof Error
        ? error.message
        : "Failed to generate solution architecture.",
      "unknown",
    );
  }
}

async function generateEffortFromSolution(input: unknown) {
  const parsed = generateEffortInputZod.parse(input);

  try {
    const metadata = await estimatesService.getProjectMetadata(parsed.projectId);
    const roles = await estimatesService.listRoles();
    if (!roles.length) {
      throw new CopilotLLMError(
        "No delivery roles are configured. Ask Copilot to add staffing roles before generating a WBS.",
        "server",
      );
    }

    const result = await mcpGenerateWbsItems({
      projectId: metadata.id,
      projectName: metadata.name,
      instructions: parsed.instructions,
    });

    const payload = (() => {
      try {
        return JSON.parse(result.content ?? "{}");
      } catch (error) {
        throw new CopilotLLMError(
          "Copilot returned invalid WBS data.",
          "server",
          undefined,
          error instanceof Error ? error.message : undefined,
        );
      }
    })();

    const validationSchema = z.object({
      items: z
        .array(
          z
            .object({
              task: wbsItemInputSchema.shape.task,
              roleId: wbsItemInputSchema.shape.roleId.optional(),
              roleName: z
                .string()
                .trim()
                .min(1, "Role name must not be empty.")
                .max(120)
                .optional(),
              hours: wbsItemInputSchema.shape.hours,
            })
            .refine(
              (item) => Boolean(item.roleId ?? item.roleName),
              "Each WBS item must reference a known role.",
            ),
        )
        .min(3),
    });

    const parsedResponse = validationSchema.parse(payload);
    const roleById = new Map(roles.map((role) => [role.id, role]));
    const roleByName = new Map(
      roles.map((role) => [role.name.trim().toLowerCase(), role]),
    );

    const normalizedItems = parsedResponse.items.map((item) => {
      const resolvedRole =
        (item.roleId && roleById.get(item.roleId)) ??
        (item.roleName
          ? roleByName.get(item.roleName.trim().toLowerCase())
          : undefined);

      if (!resolvedRole) {
        throw new CopilotLLMError(
          `Copilot referenced an unknown role (${item.roleId ?? item.roleName ?? "unspecified"}).`,
          "server",
        );
      }

      return {
        task: item.task,
        hours: item.hours,
        roleId: resolvedRole.id,
      };
    });

    const savedItems = await estimatesService.saveEffortItems(
      parsed.projectId,
      normalizedItems,
    );

    return {
      kind: "effort_wbs_items" as const,
      projectId: parsed.projectId,
      items: savedItems,
    };
  } catch (error) {
    if (error instanceof CopilotLLMError) {
      throw error;
    }
    throw new CopilotLLMError(
      error instanceof Error ? error.message : "Failed to generate WBS items.",
      "unknown",
    );
  }
}

async function generateQuoteTerms(input: unknown) {
  try {
    const schema = z.object({
      projectId: z.string().cuid(),
      subtotal: z.number().nonnegative(),
      overheadFee: z.number().nonnegative(),
      total: z.number().nonnegative(),
      wbsSummary: z.string().min(1),
      instructions: z.string().optional().nullable(),
    });

    const parsed = schema.parse(input);
    const metadata = await estimatesService.getProjectMetadata(parsed.projectId);

    const result = await mcpGenerateQuoteTerms({
      projectId: metadata.id,
      projectName: metadata.name,
      subtotal: parsed.subtotal,
      overheadFee: parsed.overheadFee,
      total: parsed.total,
      wbsSummary: parsed.wbsSummary,
      instructions: parsed.instructions ?? null,
    });

    const content = (result.content ?? "").trim();
    if (!content.length) {
      throw new CopilotLLMError(
        "Copilot did not return any quote terms content.",
        "server",
      );
    }

    const parsedResponse = z
      .object({
        paymentTerms: z.string().min(1),
        timeline: z.string().min(1),
      })
      .parse(JSON.parse(content));

    return {
      kind: "quote_terms" as const,
      projectId: parsed.projectId,
      paymentTerms: parsedResponse.paymentTerms,
      timeline: parsedResponse.timeline,
    };
  } catch (error) {
    if (error instanceof CopilotLLMError) {
      throw error;
    }
    throw new CopilotLLMError(
      error instanceof Error ? error.message : "Failed to generate quote terms.",
      "unknown",
    );
  }
}

async function reviewContractDraft(input: unknown) {
  const schema = z.object({
    agreementId: z.string().cuid().optional(),
    agreementType: z.string().optional(),
    incomingDraft: z.string().min(1, "Draft content is required."),
    excludedPolicyIds: z.array(z.string()).optional(),
  });

  const parsed = schema.parse(input);

  try {
    const result = await mcpReviewContractDraft({
      agreementId: parsed.agreementId,
      agreementType: parsed.agreementType,
      incomingDraft: parsed.incomingDraft,
      excludedPolicyIds: parsed.excludedPolicyIds,
    });

    return {
      kind: "contract_review",
      content: result.content,
      finishReason: result.finishReason ?? null,
    };
  } catch (error) {
    if (error instanceof CopilotLLMError) {
      throw error;
    }
    throw new CopilotLLMError(
      error instanceof Error ? error.message : "Failed to review contract draft.",
      "unknown",
    );
  }
}

export const copilotActions = {
  async ping() {
    return { message: "Copilot actions are available." };
  },
  async generateBusinessCaseFromArtifacts(input: unknown) {
    return generateBusinessCaseFromArtifacts(input);
  },
  async generateRequirementsFromBusinessCase(input: unknown) {
    return generateRequirementsFromBusinessCase(input);
  },
  async generateSolutionArchitectureFromRequirements(input: unknown) {
    return generateSolutionArchitectureFromRequirements(input);
  },
  async generateEffortFromSolution(input: unknown) {
    return generateEffortFromSolution(input);
  },
  async generateQuoteTerms(input: unknown) {
    return generateQuoteTerms(input);
  },
  async "contracts.reviewDraft"(input: unknown) {
    return reviewContractDraft(input);
  },
  async "chat.run"(input: unknown) {
    return chatRun(input);
  },
  async debugPingLLM(input: unknown) {
    const schema = z
      .object({
        message: z.string().min(1).optional(),
        maxTokens: z.number().int().positive().optional(),
      })
      .optional();

    const parsed = schema.parse(input) ?? {};

    const systemPrompt =
      "You output a concise JSON object so we can verify LLM connectivity. Always respond with {\"pong\":true,\"echo\":\"<short string>\"}.";

    const userMessage =
      "message" in parsed && typeof parsed.message === "string" && parsed.message.length
        ? parsed.message
        : "Return {\"pong\":true,\"echo\":\"PONG\"}.";

    const result = await mcpChat({
      systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      maxTokens:
        "maxTokens" in parsed && typeof parsed.maxTokens === "number"
          ? parsed.maxTokens
          : 64,
      temperature: 0,
      responseFormat: "json_object",
    });

    let content = (result.content ?? "").trim();
    if (!content.length) {
      content = JSON.stringify({
        pong: true,
        echo: "Fallback response",
        finishReason: result.finishReason ?? null,
      });
    }

    return {
      kind: "llm_debug_ping" as const,
      content,
      finishReason: result.finishReason ?? null,
    };
  },
};

export type CopilotActionKey = keyof typeof copilotActions;
