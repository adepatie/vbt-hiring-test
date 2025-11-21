import type { ProjectDetail } from "../../zod/estimates";
import { estimatesService } from "../../services/estimatesService";
import {
  estimateTokenCount,
  prepareArtifactContentForPrompt,
} from "../../server/artifact-summary";

const ARTIFACT_CONTEXT_TOKEN_LIMIT = Number(
  process.env.COPILOT_ARTIFACT_CONTEXT_TOKEN_LIMIT ?? 2600,
);

export interface ArtifactDigestItem {
  id: string;
  type: string;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: Date;
}

export interface ArtifactContext {
  project: ProjectDetail;
  artifactCount: number;
  fileBackedCount: number;
  digestItems: ArtifactDigestItem[];
  digestText: string;
  artifactTextSummary: string;
  artifactTextSummaryTruncated: boolean;
}

function buildDigestText(project: ProjectDetail, items: ArtifactDigestItem[]) {
  const headerLines = [
    `Project: ${project.name}`,
    project.clientName ? `Client: ${project.clientName}` : null,
    `Total artifacts: ${items.length}`,
  ].filter(Boolean) as string[];

  const bodyLines = items.map((item, index) => {
    const lines: string[] = [];
    lines.push(
      `${index + 1}. ${item.type}${
        item.originalName ? ` (${item.originalName})` : ""
      }`,
    );

    if (item.mimeType || item.sizeBytes) {
      const details: string[] = [];
      if (item.mimeType) details.push(item.mimeType);
      if (item.sizeBytes && Number.isFinite(item.sizeBytes)) {
        details.push(`${item.sizeBytes} bytes`);
      }
      if (details.length) {
        lines.push(`   File: ${details.join(" • ")}`);
      }
    }

    return lines.join("\n");
  });

  return [...headerLines, "", ...bodyLines].join("\n");
}

async function buildArtifactTextSummary(project: ProjectDetail) {
  const fileArtifacts = project.artifacts.filter(
    (artifact) => (artifact.storedFile || artifact.content) && artifact.content,
  );

  const blocks: string[] = [];
  let totalTokens = 0;
  let truncated = false;

  for (const [index, artifact] of fileArtifacts.entries()) {
    if (!artifact.content?.trim()) {
      continue;
    }

    const prepared = await prepareArtifactContentForPrompt({
      projectId: project.id,
      projectName: project.name,
      artifact,
    });

    if (!prepared.text.trim()) {
      continue;
    }

    const summaryLabel = prepared.isSummarized
      ? ` (summary of ~${prepared.sourceTokenEstimate} tokens)`
      : "";

    const header = `[Artifact ${index + 1}: ${artifact.type}${
      artifact.originalName ? ` (${artifact.originalName})` : ""
    }]${summaryLabel}`;

    const block = `${header}\n${prepared.text.trim()}`;
    const blockTokens = estimateTokenCount(block);
    if (!blockTokens) {
      continue;
    }

    if (totalTokens + blockTokens > ARTIFACT_CONTEXT_TOKEN_LIMIT) {
      truncated = true;
      break;
    }

    blocks.push(block);
    totalTokens += blockTokens;
  }

  return {
    text: blocks.join("\n\n"),
    truncated,
  };
}

export async function buildArtifactContext(
  projectId: string,
): Promise<ArtifactContext> {
  const project = await estimatesService.getProjectWithDetails(projectId);

  const digestItems: ArtifactDigestItem[] = project.artifacts.map((artifact) => ({
    id: artifact.id,
    type: artifact.type,
    originalName: artifact.originalName,
    mimeType: artifact.mimeType,
    sizeBytes: artifact.sizeBytes,
    createdAt: artifact.createdAt,
  }));

  const fileBackedCount = project.artifacts.filter(
    (artifact) => Boolean(artifact.storedFile),
  ).length;

  const digestText = buildDigestText(project, digestItems);
  const {
    text: artifactTextSummary,
    truncated: artifactTextSummaryTruncated,
  } = await buildArtifactTextSummary(project);

  return {
    project,
    artifactCount: project.artifacts.length,
    fileBackedCount,
    digestItems,
    digestText,
    artifactTextSummary,
    artifactTextSummaryTruncated,
  };
}

export type EstimateArtifactContext = ArtifactContext;


