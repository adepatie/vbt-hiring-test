import type { CopilotLLMMessage } from "../types";

export interface PromptPayload {
  systemPrompt: string;
  messages: CopilotLLMMessage[];
}

export interface BusinessCasePromptInput {
  projectName: string;
  clientName?: string | null;
  industry?: string | null;
  artifactsSummary: string;
  artifactTextSummary?: string;
  artifactTextSummaryTruncated?: boolean;
}

export const ESTIMATES_SYSTEM_PROMPT = `You are VBT's Estimates Copilot, a senior consulting assistant that drives a six-stage workflow:
1. Artifacts – inventory client inputs and missing data.
2. Business Case – craft the rationale for the project with measurable benefits.
3. Requirements – define scope, success criteria, and constraints.
4. Solution / Architecture – explain the delivery approach and target state.
5. Effort (WBS) – translate scope into roles and hours.
6. Quote – articulate commercial packaging and next steps.

Guardrails:
- Use information supplied in the context only; never fabricate data.
- Call out gaps or risks explicitly when evidence is missing.
- Keep tone consultative, concise, and executive-friendly.
- Prefer plain text with short paragraphs and bullets. Heading levels should stay within standard Markdown (##, ###) when needed.
- When summarizing artifacts, capture the essence, owners, and implications for downstream stages.
- When drafting narrative stages, respect the required structure and make approval-ready prose.
`;

const BUSINESS_CASE_STRUCTURE = `Produce a business case draft with sections focused explicitly on scope, outcomes, and constraints:
1. Scope – Describe what is in scope and out of scope for this engagement. Be concrete about inclusions and exclusions.
2. Outcomes – Describe the desired business outcomes and success measures (KPIs or qualitative outcomes). Tie these to the client's goals.
3. Constraints – Describe key constraints (time, budget, technology, org readiness, dependencies) and how they shape scope and outcomes.
4. Next Steps – Brief bullets outlining the immediate next actions for the client and VBT.

Keep the response under ~800 tokens (~600 words). Prioritize clarity on scope, outcomes, and constraints over generic background.`;

function renderContextBlock(title: string, body?: string | null) {
  if (!body) return "";
  return `${title}:\n${body.trim()}\n`;
}

export function buildBusinessCasePrompt(
  input: BusinessCasePromptInput,
): PromptPayload {
  const artifactSummaryLabel = input.artifactTextSummaryTruncated
    ? "Artifact text summary (truncated at context limit)"
    : "Artifact text summary";

  const artifactsContextBlock = [
    renderContextBlock("Artifacts digest", input.artifactsSummary),
    renderContextBlock(artifactSummaryLabel, input.artifactTextSummary),
  ]
    .filter(Boolean)
    .join("\n\n");

  const userContent = [
    `Project: ${input.projectName}`,
    input.clientName ? `Client: ${input.clientName}` : null,
    input.industry ? `Industry: ${input.industry}` : null,
    artifactsContextBlock,
    BUSINESS_CASE_STRUCTURE,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    systemPrompt: ESTIMATES_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  };
}
