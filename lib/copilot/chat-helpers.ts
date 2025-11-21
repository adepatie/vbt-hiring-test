import { CopilotLLMMessage } from "./types";
import { McpLLMResponse } from "../mcp/types";
import { MCP_TOOLS } from "../mcp/registry";
import { estimatesService } from "../services/estimatesService";
import { contractsService } from "../services/contractsService";
import {
  estimateStageOrder,
  type EstimateStage,
} from "../zod/estimates";
import { applyContextDefaults } from "./context-defaults";

// --- Types ---

export type SideEffectContext = {
  workflow?: string;
  entityId?: string;
  entityType?: "project" | "agreement";
  projectStage?: EstimateStage;
};

export type SideEffectHandler = (args: {
  input: unknown;
  result: unknown;
  context: SideEffectContext;
}) => Promise<string | null>;

type ToolExecutionRecord = {
  name: string;
  rawContent: string;
  parsedContent: unknown;
};

const getStageIndex = (stage: EstimateStage) =>
  estimateStageOrder.indexOf(stage);

function hasReachedStage(
  currentStage: EstimateStage | undefined,
  targetStage: EstimateStage,
) {
  if (!currentStage) return false;
  const currentIdx = getStageIndex(currentStage);
  const targetIdx = getStageIndex(targetStage);
  if (currentIdx === -1 || targetIdx === -1) {
    return false;
  }
  return currentIdx >= targetIdx;
}

const WBS_MUTATION_TOOLS = new Set<string>([
  "estimates.upsertWbsItems",
  "estimates.removeWbsItems",
]);

const REFRESH_ON_SUCCESS_TOOLS = new Set<string>([
  "estimates.generateWbsItems",
  "estimates.upsertWbsItems",
  "estimates.removeWbsItems",
]);

// --- Side Effect Implementations ---

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
    // Conceptual: await contractsService.markAgreementsStale(projectId);
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

// --- Helpers ---

function safeJsonParse(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function truncateText(value: string, maxLength = 400) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}

function formatToolLabel(toolName: string) {
  return toolName.replace(/\./g, " › ");
}

function formatListPreview(items: string[], limit = 3) {
  if (!items.length) return "";
  const preview = items.slice(0, limit);
  const remainder = items.length - preview.length;
  const joined = preview.join("; ");
  const suffix = remainder > 0 ? `, plus ${remainder} more` : "";
  return `${joined}${suffix}`;
}

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
          return `${formatToolLabel(record.name)}: Responded with data (${keyPreview}).`;
        }
      }

      if (Array.isArray(record.parsedContent)) {
        return `${formatToolLabel(record.name)}: Returned ${record.parsedContent.length} item(s).`;
      }

      if (record.rawContent) {
        return `${formatToolLabel(record.name)}: ${truncateText(record.rawContent, 300)}`;
      }

      return `${formatToolLabel(record.name)}: Tool completed successfully.`;
    })
    .filter(Boolean);

  return lines.join("\n");
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

export async function executeToolCalls(
  toolCalls: any[],
  openAiToolNameMap: Record<string, string>,
  context: SideEffectContext
) {
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

    try {
      const args = applyContextDefaults(
        JSON.parse(argsString),
        internalName,
        context.workflow as "estimates" | "contracts" | undefined,
        context.entityId,
        context.entityType,
      );
      const toolDef = MCP_TOOLS[internalName];

      if (!toolDef) {
        normalizedContent = {
          displayContent: `Error: Tool ${internalName} not found.`,
          rawContent: `Error: Tool ${internalName} not found.`,
          parsedContent: null,
        };
      } else {
        console.log(`[Copilot] Executing tool: ${internalName}`);
        const parsedArgs = toolDef.schema.parse(args);
        const toolResult = await toolDef.execute(parsedArgs);
        normalizedContent = normalizeToolOutputContent(toolResult);
        if (REFRESH_ON_SUCCESS_TOOLS.has(internalName)) {
          shouldRefresh = true;
        }

        const sideEffectHandlers = SIDE_EFFECTS[internalName];
        if (sideEffectHandlers) {
          for (const handler of sideEffectHandlers) {
            try {
              const note = await handler({
                input: parsedArgs,
                result: toolResult.raw || toolResult.content,
                context,
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
      }
    } catch (error) {
      const message = `Error executing tool ${internalName}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(message);
      normalizedContent = {
        displayContent: message,
        rawContent: message,
        parsedContent: null,
      };
    }

    executionSummaries.push({
      name: internalName,
      rawContent: normalizedContent.rawContent,
      parsedContent: normalizedContent.parsedContent,
    });

    toolMessages.push({
      role: "tool",
      content: normalizedContent.displayContent,
      tool_call_id: callId,
      name: internalName,
    });
  }

  return {
    toolMessages,
    sideEffectMessages,
    executionSummaries,
    shouldRefresh,
  };
}

