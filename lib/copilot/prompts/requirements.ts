import type { PromptPayload } from "./estimates";
import { ESTIMATES_SYSTEM_PROMPT } from "./estimates";

export interface RequirementsPromptInput {
  projectName: string;
  clientName?: string | null;
  artifactsSummary: string;
  businessCaseDraft: string;
  requestedFocus?: string | null;
}

const REQUIREMENTS_STRUCTURE = `Generate a concise requirements summary with these sections:
1. Functional Requirements – bullet list of capabilities.
2. Non-Functional & Operational Requirements – bullets on performance, security, availability, etc.
3. Assumptions & Dependencies – bullets on integrations, data, approvals.
4. Validation Gaps – bullets on uncertainties or missing inputs.

Keep the response under ~600 words. Use bullets.`;

function renderBlock(title: string, body?: string | null) {
  if (!body?.trim()) return "";
  return `${title}:\n${body.trim()}`;
}

export function buildRequirementsPrompt(
  input: RequirementsPromptInput,
): PromptPayload {
  const userContent = [
    `Project: ${input.projectName}`,
    input.clientName ? `Client: ${input.clientName}` : null,
    renderBlock("Artifacts digest", input.artifactsSummary),
    renderBlock(
      "Business Case draft",
      input.businessCaseDraft || "No business case content was provided.",
    ),
    renderBlock("Focus requested by reviewer", input.requestedFocus),
    REQUIREMENTS_STRUCTURE,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    systemPrompt: ESTIMATES_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  };
}

export const requirementsPrompts = {
  buildRequirementsPrompt,
};

export default requirementsPrompts;


