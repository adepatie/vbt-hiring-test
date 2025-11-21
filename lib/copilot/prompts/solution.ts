import type { PromptPayload } from "./estimates";
import { ESTIMATES_SYSTEM_PROMPT } from "./estimates";

export interface SolutionPromptInput {
  projectName: string;
  clientName?: string | null;
  artifactsSummary: string;
  businessCaseDraft: string;
  requirementsDraft: string;
  requestedFocus?: string | null;
}

const SOLUTION_STRUCTURE = `Produce a Solution / Architecture narrative with these sections:
1. Documented Approach & Delivery Phases – Summarize how the team will execute, phased milestones, and governance touchpoints.
2. Target Architecture & Integration Points – Describe the logical/physical architecture, key services, data flows, and integrations.
3. Recommended Tech Stack & Tooling – Bullet the primary platforms, frameworks, or cloud services with short rationale.
4. Risks, Assumptions & Mitigations – Call out delivery, technical, or organizational risks plus how we will address them.

Keep the response executive-ready, under ~700 words, and tie assertions back to the provided context.`;

function renderBlock(title: string, body?: string | null) {
  if (!body?.trim()) return "";
  return `${title}:\n${body.trim()}`;
}

export function buildSolutionArchitecturePrompt(
  input: SolutionPromptInput,
): PromptPayload {
  const userContent = [
    `Project: ${input.projectName}`,
    input.clientName ? `Client: ${input.clientName}` : null,
    renderBlock("Artifacts digest", input.artifactsSummary),
    renderBlock("Business Case draft", input.businessCaseDraft),
    renderBlock("Requirements draft", input.requirementsDraft),
    renderBlock("Focus requested by reviewer", input.requestedFocus),
    SOLUTION_STRUCTURE,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    systemPrompt: ESTIMATES_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  };
}

export const solutionPrompts = {
  buildSolutionArchitecturePrompt,
};

export default solutionPrompts;

