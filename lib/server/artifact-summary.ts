import type { ProjectDetail } from "../zod/estimates";
import { callProviderLLM } from "../mcp/providerClient";
import type { CopilotLLMMessage } from "../copilot/types";
import type { ArtifactSummaryMode } from "../mcp/types";
import {
  buildArtifactSummaryPrompt,
  STORAGE_SUMMARY_INSTRUCTIONS,
  PROMPT_SUMMARY_INSTRUCTIONS,
} from "../copilot/prompts/artifactSummaries";

const APPROX_CHARS_PER_TOKEN = 4;
export const ARTIFACT_PROMPT_TOKEN_LIMIT = 500;
const PROMPT_SUMMARY_MAX_TOKENS = 450;
const STORAGE_SUMMARY_MAX_TOKENS = 500;
const SUMMARY_PROVENANCE_MARKERS = [
  "[AI-generated summary",
  "[Truncated preview",
];

interface ArtifactIdentity {
  id: string;
  type: string;
  originalName?: string | null;
}

interface PrepareArtifactContentParams {
  projectId: string;
  projectName: string;
  artifact: ProjectDetail["artifacts"][number];
}

export interface PreparedArtifactContent {
  text: string;
  isSummarized: boolean;
  sourceTokenEstimate: number;
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

function buildArtifactLabel(identity: ArtifactIdentity) {
  return `${identity.type}${identity.originalName ? ` (${identity.originalName})` : ""}`;
}

async function runArtifactSummarization({
  projectId,
  projectName,
  identity,
  mode,
  rawText,
  maxTokens,
}: {
  projectId: string;
  projectName?: string;
  identity: ArtifactIdentity;
  mode: ArtifactSummaryMode;
  rawText: string;
  maxTokens: number;
}) {
  const artifactLabel = buildArtifactLabel(identity);
  const instructions =
    mode === "storage"
      ? STORAGE_SUMMARY_INSTRUCTIONS
      : PROMPT_SUMMARY_INSTRUCTIONS;

  const { systemPrompt, messages } = buildArtifactSummaryPrompt({
    projectName,
    artifactLabel,
    instructions,
    rawText,
  });

  const result = await callProviderLLM({
    systemPrompt,
    messages: messages as CopilotLLMMessage[],
    maxTokens,
    temperature: 0.2,
  });

  return result.content?.trim() ?? "";
}

export async function summarizeArtifactForStorage({
  projectId,
  projectName,
  identity,
  rawContent,
}: {
  projectId: string;
  projectName?: string;
  identity: ArtifactIdentity;
  rawContent: string;
}): Promise<string> {
  const normalized = rawContent.trim();
  if (!normalized.length) {
    return "";
  }

  try {
    const summary = await runArtifactSummarization({
      projectId,
      projectName,
      identity,
      mode: "storage",
      rawText: normalized,
      maxTokens: STORAGE_SUMMARY_MAX_TOKENS,
    });

    if (summary.length) {
      return `${summary}\n\n[AI-generated summary of uploaded artifact '${buildArtifactLabel(identity)}']`;
    }
  } catch (error) {
    console.warn("[artifact-summary] Failed to summarize for storage, falling back to truncated text.", {
      artifactId: identity.id,
      error: error instanceof Error ? error.message : error,
    });
  }

  const tokenEstimate = estimateTokenCount(normalized);
  const truncated = normalized.slice(
    0,
    ARTIFACT_PROMPT_TOKEN_LIMIT * APPROX_CHARS_PER_TOKEN,
  );
  return `${truncated}\n\n[Truncated preview of ~${tokenEstimate} tokens. Re-upload smaller excerpts for full fidelity.]`;
}

export function hasSummaryProvenance(value?: string | null) {
  if (!value) return false;
  return SUMMARY_PROVENANCE_MARKERS.some((marker) => value.includes(marker));
}

async function summarizeLargeArtifactForPrompt(
  params: PrepareArtifactContentParams & { normalized: string; tokenEstimate: number },
): Promise<string> {
  const { artifact, normalized, projectName, projectId } = params;

  const summary = await runArtifactSummarization({
    projectId,
    projectName,
    identity: { id: artifact.id, type: artifact.type, originalName: artifact.originalName },
    mode: "prompt",
    rawText: normalized,
    maxTokens: PROMPT_SUMMARY_MAX_TOKENS,
  });

  if (summary.length) {
    return `${summary}\n\n[Summary generated from ~${params.tokenEstimate} tokens of source text]`;
  }

  return normalized.slice(0, ARTIFACT_PROMPT_TOKEN_LIMIT * APPROX_CHARS_PER_TOKEN);
}

export async function prepareArtifactContentForPrompt(
  params: PrepareArtifactContentParams,
): Promise<PreparedArtifactContent> {
  const normalized = params.artifact.content?.trim() ?? "";
  if (!normalized) {
    return {
      text: "",
      isSummarized: false,
      sourceTokenEstimate: 0,
    };
  }

  const tokenEstimate = estimateTokenCount(normalized);

  if (tokenEstimate <= ARTIFACT_PROMPT_TOKEN_LIMIT) {
    return {
      text: normalized,
      isSummarized: false,
      sourceTokenEstimate: tokenEstimate,
    };
  }

  try {
    const summary = await summarizeLargeArtifactForPrompt({
      ...params,
      normalized,
      tokenEstimate,
    });

    return {
      text: summary,
      isSummarized: true,
      sourceTokenEstimate: tokenEstimate,
    };
  } catch (error) {
    console.warn(
      "[Copilot] Failed to summarize artifact for prompt; falling back to truncated text.",
      {
        artifactId: params.artifact.id,
        error: error instanceof Error ? error.message : error,
      },
    );

    const truncated = `${normalized.slice(
      0,
      ARTIFACT_PROMPT_TOKEN_LIMIT * APPROX_CHARS_PER_TOKEN,
    )}\n\n[Truncated preview of ~${tokenEstimate} tokens of source text. Upload smaller excerpts for full fidelity.]`;

    return {
      text: truncated,
      isSummarized: true,
      sourceTokenEstimate: tokenEstimate,
    };
  }
}
