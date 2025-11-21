import type { PromptPayload } from "./estimates";
import { ESTIMATES_SYSTEM_PROMPT } from "./estimates";
import {
  formatRoleCatalogForPrompt,
  type RolePromptDescriptor,
} from "./roles";

export interface WbsPromptInput {
  projectName: string;
  clientName?: string | null;
  artifactsSummary: string;
  businessCaseDraft?: string | null;
  requirementsDraft?: string | null;
  solutionDraft: string;
  instructions?: string | null;
  roles: RolePromptDescriptor[];
}

const WBS_STRUCTURE = `You are preparing a consulting-quality Work Breakdown Structure (WBS) for the Effort stage.\nReturn structured rows that each include:\n- task: concise description of the workstream or deliverable (max 140 chars).\n- role: primary role accountable for the task (e.g., Solution Architect, Senior Engineer, QA Lead, PM).\n- hours: numeric estimate (2–40) representing the budgeted effort for that line item. Break larger tasks into multiple smaller items.\n\nPrioritize phases such as discovery/alignment, architecture, build, testing, deployment, knowledge transfer, and project management. Tie each entry back to the supplied Solution draft and upstream context.`;

function renderBlock(title: string, body?: string | null) {
  if (!body?.trim()) return "";
  return `${title}:\n${body.trim()}`;
}

export function buildWbsPrompt(input: WbsPromptInput): PromptPayload {
  const userContent = [
    `Project: ${input.projectName}`,
    input.clientName ? `Client: ${input.clientName}` : null,
    renderBlock("Artifacts digest", input.artifactsSummary),
    renderBlock("Business Case context", input.businessCaseDraft),
    renderBlock("Requirements summary", input.requirementsDraft),
    renderBlock("Approved Solution / Architecture draft", input.solutionDraft),
    renderBlock(
      "Available delivery roles",
      formatRoleCatalogForPrompt(input.roles),
    ),
    renderBlock("Additional reviewer focus", input.instructions),
    WBS_STRUCTURE,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    systemPrompt: ESTIMATES_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  };
}

export const wbsPrompts = {
  buildWbsPrompt,
};

export default wbsPrompts;

