export const STORAGE_SUMMARY_INSTRUCTIONS = [
  "- Capture concrete requirements, KPIs, integrations, data sources, constraints, and timelines.",
  "- Preserve any quantitative details (hours, KPIs, budgets, volumes).",
  "- Note explicit out-of-scope items, assumptions, and risks.",
  "- Keep bullets for lists; short paragraphs elsewhere.",
  "- Include open questions or missing inputs the artifact calls out.",
  "- Maintain author intent; do not add new ideas.",
];

export const PROMPT_SUMMARY_INSTRUCTIONS = [
  "- Summarize in concise bullets/paragraphs.",
  "- Highlight requirements, KPIs, constraints, timelines, integrations.",
  "- Include any explicit risks or open questions.",
  "- Keep < 600 tokens (~2400 characters).",
];

export interface ArtifactSummaryPromptInput {
  projectName?: string;
  artifactLabel: string;
  instructions: string[];
  rawText: string;
}

export function buildArtifactSummaryPrompt({
  projectName,
  artifactLabel,
  instructions,
  rawText,
}: ArtifactSummaryPromptInput) {
  const systemPrompt =
    "You summarize client discovery artifacts for VBT's Estimates Copilot. Preserve all critical requirements, constraints, and metrics so downstream stages can rely on the summary.";

  const userContent = [
    projectName ? `Project: ${projectName}` : null,
    `Artifact: ${artifactLabel}`,
    "Instructions:",
    ...instructions,
    "",
    "Full artifact text:",
    rawText,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    systemPrompt,
    messages: [{ role: "user" as const, content: userContent }],
  };
}

