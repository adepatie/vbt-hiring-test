import path from "node:path";

import type { Artifact } from "@/lib/zod/estimates";
import { resolveArtifactFilePath, saveArtifactFile } from "./artifact-storage";
import { extractArtifactText } from "./artifact-text";
import { summarizeArtifactForStorage } from "./artifact-summary";
import { estimatesService } from "../services/estimatesService";

export interface IngestArtifactFileInput {
  projectId: string;
  projectName?: string | null;
  type: string;
  notes?: string;
  file: File;
}

export async function ingestArtifactFile({
  projectId,
  projectName,
  type,
  notes,
  file,
}: IngestArtifactFileInput): Promise<Artifact> {
  const savedFile = await saveArtifactFile(projectId, file);

  const absolutePath = resolveArtifactFilePath(savedFile.storedFile);
  const extractedText = await extractArtifactText(absolutePath, {
    extension: path.extname(savedFile.storedFile),
    mimeType: savedFile.mimeType,
  });

  const sections: string[] = [];
  if (notes?.trim()) {
    sections.push(`Uploader Notes:\n${notes.trim()}`);
  }
  if (extractedText?.trim()) {
    sections.push(`Extracted File Text:\n${extractedText}`);
  }

  const combinedContent = sections.join("\n\n---\n\n");
  const summaryContent = await summarizeArtifactForStorage({
    projectId,
    identity: {
      id: "pending-artifact",
      type,
      originalName: savedFile.originalName,
    },
    projectName: projectName ?? undefined,
    rawContent: combinedContent || "",
  });

  const artifact = await estimatesService.addArtifact({
    projectId,
    type,
    content: summaryContent,
    url: null,
    ...savedFile,
  });

  return artifact;
}


