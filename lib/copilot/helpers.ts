import { CopilotLLMError } from "./errors";
import { ZodError } from "zod";
import { estimatesService } from "../services/estimatesService";
import { contractsService } from "../services/contractsService";
import { MCP_TOOLS, getOpenAiTools } from "../mcp/registry";
import { McpLLMResponse } from "../mcp/types";
import {
  CopilotLLMMessage,
  CopilotToolStatusMeta,
  CopilotWorkflow,
  SideEffectContext,
} from "./types";
import {
  estimateStageOrder,
  type EstimateStage,
} from "../zod/estimates";
import { applyContextDefaults } from "./context-defaults";

// --- Constants & Rate Limiting ---

const ALL_TOOL_NAMES = Object.keys(MCP_TOOLS);
const ESTIMATE_TOOL_NAMES = new Set(
  ALL_TOOL_NAMES.filter(
    (name) =>
      name.startsWith("estimates.") ||
      name.startsWith("quote.") ||
      name.startsWith("roles."),
  ),
);
const CONTRACT_TOOL_NAMES = new Set(
  ALL_TOOL_NAMES.filter((name) => name.startsWith("contracts.")),
);
CONTRACT_TOOL_NAMES.add("estimates.getProjectDetails");
CONTRACT_TOOL_NAMES.add("estimates.searchProjects");

const ESTIMATE_READ_ONLY_TOOL_NAMES = new Set<string>([
  "estimates.getProjectDetails",
  "estimates.searchProjects",
  "estimates.summarizeArtifact",
  "roles.list",
  "quote.getPricingDefaults",
  "contracts.listAgreements",
  "contracts.getAgreement",
  "contracts.validateAnalysis",
]);

const THROTTLED_TOOL_NAMES = new Set<string>([
  "estimates.generateBusinessCaseFromArtifacts",
  "estimates.generateRequirementsSummary",
  "estimates.generateSolutionArchitecture",
  "estimates.generateWbsItems",
  "estimates.upsertWbsItems",
  "estimates.removeWbsItems",
  "quote.generateTerms",
  "quote.updatePricingDefaults",
  "roles.create",
  "roles.update",
  "contracts.create",
  "contracts.createFromProject",
  "contracts.createVersion",
  "contracts.updateNotes",
]);

const MUTATION_THROTTLE_WINDOW_MS = 60_000;
const MUTATION_THROTTLE_LIMIT = 3;
const mutationThrottle = new Map<string, { count: number; windowStart: number }>();

const TOOL_STAGE_REQUIREMENTS: Partial<Record<string, EstimateStage>> = {
  "estimates.generateBusinessCaseFromArtifacts": "BUSINESS_CASE",
  "estimates.generateRequirementsSummary": "REQUIREMENTS",
  "estimates.generateSolutionArchitecture": "SOLUTION",
  "estimates.generateWbsItems": "EFFORT",
  "estimates.upsertWbsItems": "EFFORT",
  "estimates.removeWbsItems": "EFFORT",
  "quote.generateTerms": "EFFORT",
  "quote.updatePricingDefaults": "QUOTE",
};

const WBS_MUTATION_TOOLS = new Set<string>([
  "estimates.upsertWbsItems",
  "estimates.removeWbsItems",
]);

const REFRESH_ON_SUCCESS_TOOLS = new Map<string, EstimateStage>([
  ["estimates.generateWbsItems", "EFFORT"],
  ["estimates.upsertWbsItems", "EFFORT"],
  ["estimates.removeWbsItems", "EFFORT"],
  ["quote.generateTerms", "QUOTE"],
]);

const STAGE_LABEL_CACHE = new Map<EstimateStage, string>();

const getStageIndex = (stage: EstimateStage) =>
  estimateStageOrder.indexOf(stage);

function formatStageLabel(stage: EstimateStage) {
  if (STAGE_LABEL_CACHE.has(stage)) {
    return STAGE_LABEL_CACHE.get(stage)!;
  }

  const label = stage
    .split("_")
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(" ")
    .replace("Wbs", "WBS");

  STAGE_LABEL_CACHE.set(stage, label);
  return label;
}

function canMutateStage(
  currentStage: EstimateStage | undefined,
  targetStage: EstimateStage,
) {
  if (!currentStage) return true;
  const currentIdx = getStageIndex(currentStage);
  const targetIdx = getStageIndex(targetStage);
  if (currentIdx === -1 || targetIdx === -1) {
    return true;
  }
  return currentIdx >= targetIdx;
}

function hasReachedStage(
  currentStage: EstimateStage | undefined,
  targetStage: EstimateStage,
) {
  if (!currentStage) {
    return false;
  }
  const currentIdx = getStageIndex(currentStage);
  const targetIdx = getStageIndex(targetStage);
  if (currentIdx === -1 || targetIdx === -1) {
    return false;
  }
  return currentIdx >= targetIdx;
}

// --- Helper Functions ---

export function getAllowedToolSetForContext(
  workflow: CopilotWorkflow | undefined,
  options?: { readOnly?: boolean },
): Set<string> | null {
  if (!workflow) {
    return null;
  }
  if (workflow === "estimates") {
    return options?.readOnly ? ESTIMATE_READ_ONLY_TOOL_NAMES : ESTIMATE_TOOL_NAMES;
  }
  if (workflow === "contracts") {
    return CONTRACT_TOOL_NAMES;
  }
  return null;
}

export function filterToolsByAllowlist(
  tools: ReturnType<typeof getOpenAiTools>,
  nameMap: Record<string, string>,
  allowedSet: Set<string> | null,
) {
  if (!allowedSet) {
    return tools;
  }
  return tools.filter((tool) => {
    const internalName = nameMap[tool.function.name];
    return internalName ? allowedSet.has(internalName) : false;
  });
}

export function assertMutationRateLimit(toolName: string, entityId?: string) {
  if (!entityId || !THROTTLED_TOOL_NAMES.has(toolName)) {
    return;
  }

  const key = `${toolName}:${entityId}`;
  const now = Date.now();
  const entry = mutationThrottle.get(key);

  if (!entry || now - entry.windowStart > MUTATION_THROTTLE_WINDOW_MS) {
    mutationThrottle.set(key, { count: 1, windowStart: now });
    return;
  }

  if (entry.count >= MUTATION_THROTTLE_LIMIT) {
    throw new CopilotLLMError(
      `Slow down: ${toolName} already ran ${entry.count} times in the last minute for this record.`,
      "rate_limit",
      429,
    );
  }

  entry.count += 1;
  mutationThrottle.set(key, entry);
}

export function logToolInvocation(details: {
  tool: string;
  workflow?: CopilotWorkflow | undefined;
  entityId?: string;
  status: "success" | "error" | "blocked";
  durationMs?: number;
  message?: string;
}) {
  console.info("[Copilot][ToolInvocation]", {
    ...details,
    timestamp: new Date().toISOString(),
  });
}

export function safeJsonParse(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function truncateText(value: string, maxLength = 400) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}

export function formatToolLabel(toolName: string) {
  return toolName.replace(/\./g, " › ");
}

export function formatListPreview(items: string[], limit = 3) {
  if (!items.length) return "";
  const preview = items.slice(0, limit);
  const remainder = items.length - preview.length;
  const joined = preview.join("; ");
  const suffix = remainder > 0 ? `, plus ${remainder} more` : "";
  return `${joined}${suffix}`;
}

export type ToolExecutionRecord = {
  name: string;
  rawContent: string;
  parsedContent: unknown;
  status?: CopilotToolStatusMeta["status"];
  summary?: string;
  detail?: string;
};

function summarizeWbsUpdate(record: ToolExecutionRecord) {
  if (
    !record.parsedContent ||
    typeof record.parsedContent !== "object" ||
    !Array.isArray((record.parsedContent as any).items)
  ) {
    return null;
  }

  const items = (record.parsedContent as any).items as Array<Record<string, unknown>>;
  if (!items.length) {
    return `${formatToolLabel(record.name)}: Saved an empty WBS payload.`;
  }

  const preview = formatListPreview(
    items.map((item) => {
      const task = typeof item.task === "string" ? item.task : "Unnamed task";
      const role =
        typeof item.roleName === "string"
          ? item.roleName
          : typeof item.roleId === "string"
            ? item.roleId
            : null;
      const hours =
        typeof item.hours === "number"
          ? `${Math.round(item.hours * 100) / 100}h`
          : null;
      return [task, role, hours].filter(Boolean).join(" · ");
    }),
  );

  return `${formatToolLabel(record.name)}: Updated ${items.length} work item(s)${preview ? ` (${preview})` : ""}.`;
}

export function summarizeToolExecutions(records: ToolExecutionRecord[]) {
  if (!records.length) {
    return "";
  }

  const lines = records
    .map((record) => {
      if (record.summary) {
        return record.summary;
      }

      if (
        record.parsedContent &&
        typeof record.parsedContent === "object" &&
        (record.parsedContent as any).type === "tool_error"
      ) {
        const payload = record.parsedContent as ToolErrorPayload;
        return `${formatToolLabel(record.name)} — ${payload.summary}`;
      }
      if (WBS_MUTATION_TOOLS.has(record.name)) {
        const summary = summarizeWbsUpdate(record);
        if (summary) return summary;
      }

      if (
        record.parsedContent &&
        typeof record.parsedContent === "object" &&
        !Array.isArray(record.parsedContent)
      ) {
        const keys = Object.keys(record.parsedContent as Record<string, unknown>);
        if (keys.length) {
          const keyPreview =
            keys.length > 4 ? `${keys.slice(0, 4).join(", ")}, …` : keys.join(", ");
          return `${formatToolLabel(record.name)} — responded with ${keyPreview}.`;
        }
      }

      if (Array.isArray(record.parsedContent)) {
        return `${formatToolLabel(record.name)} — returned ${record.parsedContent.length} item(s).`;
      }

      if (record.rawContent) {
        return `${formatToolLabel(record.name)} — ${truncateText(record.rawContent, 120)}`;
      }

      return `${formatToolLabel(record.name)} — success.`;
    })
    .filter(Boolean);

  return lines.join("\n");
}

function buildToolStatusMeta({
  tool,
  status,
  summary,
  detail,
}: {
  tool: string;
  status: CopilotToolStatusMeta["status"];
  summary: string;
  detail?: string;
}): CopilotToolStatusMeta {
  return {
    type: "tool_status",
    label: formatToolLabel(tool),
    status,
    summary,
    detail,
  };
}

export function normalizeToolOutputContent(
  toolResult: McpLLMResponse,
): { displayContent: string; rawContent: string; parsedContent: unknown } {
  const primaryContent =
    typeof toolResult.content === "string"
      ? toolResult.content
      : toolResult.content
        ? JSON.stringify(toolResult.content)
        : "";

  const fallbackContent =
    toolResult.raw && typeof toolResult.raw === "object"
      ? (() => {
          try {
            return JSON.stringify(toolResult.raw);
          } catch {
            return "";
          }
        })()
      : "";

  const rawContent = (primaryContent || fallbackContent || "").trim();
  const parsedContent = safeJsonParse(rawContent);

  let displayContent = rawContent;
  if (parsedContent) {
    try {
      displayContent = JSON.stringify(parsedContent, null, 2);
    } catch {
      // Keep raw content if pretty-print fails
    }
  } else if (!displayContent.length) {
    displayContent = "Tool executed successfully. No additional output was returned.";
  }

  return { displayContent, rawContent, parsedContent };
}

export type ToolErrorPayload = {
  type: "tool_error";
  tool: string;
  summary: string;
  detail?: string;
};

function stringifyErrorDetail(error: unknown): string {
  if (error instanceof ZodError) {
    return JSON.stringify(error.issues, null, 2);
  }
  if (error instanceof CopilotLLMError && error.detail) {
    try {
      return typeof error.detail === "string"
        ? error.detail
        : JSON.stringify(error.detail, null, 2);
    } catch {
      return String(error.detail);
    }
  }
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

export function buildToolErrorPayload({
  tool,
  error,
}: {
  tool: string;
  error: unknown;
}): ToolErrorPayload {
  const toolLabel = formatToolLabel(tool);
  let summary = `Couldn't run ${toolLabel}.`;

  if (error instanceof CopilotLLMError) {
    summary = error.message;
  } else if (error instanceof ZodError) {
    summary = error.issues[0]?.message ?? "Invalid tool input.";
  } else if (error instanceof Error) {
    summary = error.message || summary;
  }

  return {
    type: "tool_error",
    tool,
    summary,
    detail: stringifyErrorDetail(error),
  };
}

// --- Side Effect Implementations ---

export type SideEffectHandler = (args: {
  input: unknown;
  result: unknown;
  context: SideEffectContext;
}) => Promise<string | null>;

async function recalculateQuoteTotals({
  input,
  context,
}: {
  input: unknown;
  context: SideEffectContext;
}) {
  const projectId = (input as any).projectId || context.entityId;
  if (!projectId) return null;

  const lockState = await estimatesService.getProjectLockContext(projectId);
  if (!hasReachedStage(lockState.stage, "QUOTE")) {
    return null;
  }

  // Fetch existing quote to preserve fields
  const existingQuote = await estimatesService.getQuote(projectId);

  // Force save to trigger recalculation from WBS items
  await estimatesService.saveQuote({
    projectId,
    overheadFee: existingQuote?.overheadFee ?? undefined,
    paymentTerms: existingQuote?.paymentTerms ?? undefined,
    timeline: existingQuote?.timeline ?? undefined,
    delivered: existingQuote?.delivered ?? undefined,
  });

  return "Recalculated quote totals based on new WBS items.";
}

async function maybeRegenerateQuoteTerms({
  input,
  context,
}: {
  input: unknown;
  context: SideEffectContext;
}) {
  const projectId = (input as any).projectId || context.entityId;
  if (!projectId) return null;

  const lockState = await estimatesService.getProjectLockContext(projectId);
  if (!hasReachedStage(lockState.stage, "QUOTE")) {
    return null;
  }

  return null;
}

async function saveQuoteTerms({
  input,
  result,
}: {
  input: unknown;
  result: unknown;
}) {
  const projectId = (input as any).projectId;
  const terms = result as { paymentTerms: string; timeline: string };

  if (!projectId || !terms.paymentTerms) return null;

  const existingQuote = await estimatesService.getQuote(projectId);
  await estimatesService.saveQuote({
    projectId,
    paymentTerms: terms.paymentTerms,
    timeline: terms.timeline,
    overheadFee: existingQuote?.overheadFee ?? undefined,
  });

  return "Saved generated payment terms and timeline to the quote.";
}

async function markLinkedAgreementsStale({
  input,
  context,
}: {
  input: unknown;
  context: SideEffectContext;
}) {
  const projectId = (input as any).projectId || context.entityId;
  if (!projectId) return null;

  const agreements = await contractsService.listAgreements(projectId);
  if (agreements.length > 0) {
    return `Note: ${agreements.length} linked agreement(s) may need re-validation against the updated estimate.`;
  }
  return null;
}

async function updatePricingDefaultsForFutureQuotesOnly() {
  return "Updated global pricing defaults for future quotes.";
}

async function recalculateQuotesForRoleProjects({
  input,
  result,
}: {
  input: unknown;
  result: unknown;
}) {
  return "Note: Existing quotes using this role have NOT been automatically recalculated. Please review them.";
}

async function recordValidationSnapshot({
  input,
  result,
}: {
  input: unknown;
  result: unknown;
}) {
  return "Validation analysis complete.";
}

export const SIDE_EFFECTS: Record<string, SideEffectHandler[]> = {
  "estimates.generateWbsItems": [recalculateQuoteTotals, maybeRegenerateQuoteTerms],
  "estimates.upsertWbsItems": [recalculateQuoteTotals, maybeRegenerateQuoteTerms],
  "estimates.removeWbsItems": [recalculateQuoteTotals, maybeRegenerateQuoteTerms],
  "quote.generateTerms": [saveQuoteTerms, markLinkedAgreementsStale],
  "quote.updatePricingDefaults": [updatePricingDefaultsForFutureQuotesOnly],
  "roles.update": [recalculateQuotesForRoleProjects],
  "contracts.validateAnalysis": [recordValidationSnapshot],
};

// --- Helper: executeToolCalls ---

export async function executeToolCalls({
  toolCalls,
  openAiToolNameMap,
  allowedToolSet,
  workflow,
  entityId,
  entityType,
  projectStage,
}: {
  toolCalls: any[];
  openAiToolNameMap: Record<string, string>;
  allowedToolSet: Set<string> | null;
  workflow?: CopilotWorkflow;
  entityId?: string;
  entityType?: "project" | "agreement";
  projectStage?: EstimateStage;
}) {
  const toolMessages: CopilotLLMMessage[] = [];
  const sideEffectMessages: CopilotLLMMessage[] = [];
  const executionSummaries: ToolExecutionRecord[] = [];
  let shouldRefresh = false;

  for (const call of toolCalls) {
    const openAiName = call.function.name;
    const internalName = openAiToolNameMap[openAiName] ?? openAiName;
    const argsString = call.function.arguments;
    const callId = call.id;

    let normalizedContent = {
      displayContent:
        "Tool executed successfully. No additional output was returned.",
      rawContent: "",
      parsedContent: null as unknown,
    };
    let invocationStatus: CopilotToolStatusMeta["status"] = "success";
    let summaryText: string | null = null;
    let detailText: string | null = null;

    const setNormalizedContentFromError = (
      friendlyError: ToolErrorPayload,
      status: CopilotToolStatusMeta["status"],
    ) => {
      invocationStatus = status;
      normalizedContent = {
        displayContent: JSON.stringify(friendlyError),
        rawContent: friendlyError.detail ?? friendlyError.summary,
        parsedContent: friendlyError,
      };
      summaryText = friendlyError.summary;
      detailText = null;
    };

    try {
      const args = applyContextDefaults(
        JSON.parse(argsString),
        internalName,
        workflow,
        entityId,
        entityType,
      );
      const toolDef = MCP_TOOLS[internalName];

      if (!toolDef) {
        const friendlyError = buildToolErrorPayload({
          tool: internalName,
          error: new Error(`Tool ${internalName} is not registered.`),
        });
        setNormalizedContentFromError(friendlyError, "error");
        logToolInvocation({
          tool: internalName,
          workflow,
          entityId,
          status: "error",
          message: friendlyError.summary,
        });
      } else if (allowedToolSet && !allowedToolSet.has(internalName)) {
        const friendlyError = buildToolErrorPayload({
          tool: internalName,
          error: new Error(
            `Tool ${internalName} is not available in this workflow or context.`,
          ),
        });
        setNormalizedContentFromError(friendlyError, "blocked");
        logToolInvocation({
          tool: internalName,
          workflow,
          entityId,
          status: "blocked",
          message: friendlyError.summary,
        });
      } else if (
        workflow === "estimates" &&
        TOOL_STAGE_REQUIREMENTS[internalName] &&
        !canMutateStage(projectStage, TOOL_STAGE_REQUIREMENTS[internalName]!)
      ) {
        const requiredStage = TOOL_STAGE_REQUIREMENTS[internalName]!;
        const friendlyError = buildToolErrorPayload({
          tool: internalName,
          error: new CopilotLLMError(
            `This project must reach the ${formatStageLabel(requiredStage)} stage before running ${formatToolLabel(internalName)}.`,
            "bad_request",
            400,
          ),
        });
        setNormalizedContentFromError(friendlyError, "blocked");
        logToolInvocation({
          tool: internalName,
          workflow,
          entityId,
          status: "blocked",
          message: friendlyError.summary,
        });
      } else {
        console.log(`[Copilot] Executing tool: ${internalName}`);
        assertMutationRateLimit(internalName, entityId);
        const parsedArgs = toolDef.schema.parse(args);
        const toolStart = Date.now();
        const toolResult = await toolDef.execute(parsedArgs);
        logToolInvocation({
          tool: internalName,
          workflow,
          entityId,
          status: "success",
          durationMs: Date.now() - toolStart,
        });
        normalizedContent = normalizeToolOutputContent(toolResult);

        const sideEffectHandlers = SIDE_EFFECTS[internalName];
        if (sideEffectHandlers) {
          for (const handler of sideEffectHandlers) {
            try {
              const note = await handler({
                input: parsedArgs,
                result: toolResult.raw || toolResult.content,
                context: {
                  workflow,
                  entityId,
                  entityType,
                  projectStage,
                },
              });
              if (note) {
                shouldRefresh = true;
                sideEffectMessages.push({
                  role: "system",
                  content: `[Side Effect] ${note}`,
                });
              }
            } catch (err) {
              console.error(`Side effect failed for ${internalName}`, err);
              sideEffectMessages.push({
                role: "system",
                content: `[Side Effect Error] Failed to execute side effect for ${internalName}: ${err instanceof Error ? err.message : String(err)}`,
              });
            }
          }
        }

        summaryText = null; // Let the summarizer handle it
        const refreshStage = REFRESH_ON_SUCCESS_TOOLS.get(internalName);
        if (
          refreshStage &&
          hasReachedStage(projectStage, refreshStage)
        ) {
          shouldRefresh = true;
        }
      }
    } catch (error) {
      if (invocationStatus === "success") {
        invocationStatus = "error";
      }
      const friendlyError = buildToolErrorPayload({
        tool: internalName,
        error,
      });
      console.error(
        `Error executing tool ${internalName}: ${friendlyError.summary}`,
        error,
      );
      logToolInvocation({
        tool: internalName,
        workflow,
        entityId,
        status: invocationStatus === "blocked" ? "blocked" : "error",
        message: friendlyError.summary,
      });
      setNormalizedContentFromError(
        friendlyError,
        invocationStatus === "blocked" ? "blocked" : "error",
      );
    }

    const executionRecord: ToolExecutionRecord = {
      name: internalName,
      rawContent: normalizedContent.rawContent,
      parsedContent: normalizedContent.parsedContent,
      status: invocationStatus,
    };

    // Generate a rich summary for the UI/Metadata
    let computedSummary = summaryText;
    if (!computedSummary) {
        // Re-use the logic from summarizeToolExecutions for a single record
        // We wrap it in an array to reuse the function, or just accept the simple fallback for now
        // to avoid circular dependencies or code duplication.
        // For now, let's use a simple fallback if summaryText is null, 
        // BUT importantly, we must pass the DATA to the LLM.
        
        computedSummary = `${formatToolLabel(internalName)} — ${invocationStatus === "success" ? "success" : invocationStatus}.`;
        
        // Try to get a better summary if possible
        const richSummary = summarizeToolExecutions([executionRecord]);
        if (richSummary) {
            computedSummary = richSummary;
        }
    }

    executionRecord.summary = computedSummary;
    executionRecord.detail = detailText ?? undefined;
    executionSummaries.push(executionRecord);

    toolMessages.push({
      role: "tool",
      content: normalizedContent.displayContent, // Corrected: Send actual data to LLM
      tool_call_id: callId,
      name: internalName,
      meta: buildToolStatusMeta({
        tool: internalName,
        status: invocationStatus,
        summary: computedSummary,
        detail: detailText ?? undefined,
      }),
    });
  }

  return {
    toolMessages,
    sideEffectMessages,
    executionSummaries,
    shouldRefresh,
  };
}
