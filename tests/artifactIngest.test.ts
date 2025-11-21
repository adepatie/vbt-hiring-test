import { File } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/artifact-storage", () => ({
  saveArtifactFile: vi.fn(),
  resolveArtifactFilePath: vi.fn(),
}));

vi.mock("@/lib/server/artifact-text", () => ({
  extractArtifactText: vi.fn(),
}));

vi.mock("@/lib/server/artifact-summary", () => ({
  summarizeArtifactForStorage: vi.fn(),
}));

vi.mock("@/lib/services/estimatesService", () => ({
  estimatesService: {
    addArtifact: vi.fn(),
  },
}));

import { ingestArtifactFile } from "@/lib/server/artifact-ingest";
import {
  resolveArtifactFilePath,
  saveArtifactFile,
} from "@/lib/server/artifact-storage";
import { extractArtifactText } from "@/lib/server/artifact-text";
import { summarizeArtifactForStorage } from "@/lib/server/artifact-summary";
import { estimatesService } from "@/lib/services/estimatesService";

const saveArtifactFileMock = vi.mocked(saveArtifactFile);
const resolveArtifactFilePathMock = vi.mocked(resolveArtifactFilePath);
const extractArtifactTextMock = vi.mocked(extractArtifactText);
const summarizeArtifactForStorageMock = vi.mocked(summarizeArtifactForStorage);
const addArtifactMock = vi.mocked(estimatesService.addArtifact);

describe("ingestArtifactFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveArtifactFileMock.mockResolvedValue({
      storedFile: "proj/sample.md",
      originalName: "sample.md",
      mimeType: "text/markdown",
      sizeBytes: 128,
    });
    resolveArtifactFilePathMock.mockReturnValue("/tmp/proj/sample.md");
    extractArtifactTextMock.mockResolvedValue("Extracted text body.");
    summarizeArtifactForStorageMock.mockResolvedValue(
      "Summary content.\n\n[AI-generated summary of uploaded artifact 'Client Interview Notes (sample.md)']",
    );
    addArtifactMock.mockResolvedValue({
      id: "artifact-1",
      projectId: "project-1",
      type: "Client Interview Notes",
      content: "Summary content.",
      url: null,
      originalName: "sample.md",
      storedFile: "proj/sample.md",
      mimeType: "text/markdown",
      sizeBytes: 128,
      createdAt: new Date(),
    } as any);
  });

  it("saves, summarizes, and persists artifacts with uploader notes", async () => {
    const file = new File([Buffer.from("file body")], "sample.md", {
      type: "text/markdown",
    });

    const artifact = await ingestArtifactFile({
      projectId: "project-1",
      projectName: "Retail Performance Console",
      type: "Client Interview Notes",
      notes: "Key quotes captured during kickoff.",
      file,
    });

    expect(saveArtifactFileMock).toHaveBeenCalledWith("project-1", file);
    expect(resolveArtifactFilePathMock).toHaveBeenCalledWith("proj/sample.md");
    expect(extractArtifactTextMock).toHaveBeenCalled();
    expect(summarizeArtifactForStorageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        identity: expect.objectContaining({
          type: "Client Interview Notes",
          originalName: "sample.md",
        }),
        projectName: "Retail Performance Console",
      }),
    );
    const rawContentArg =
      summarizeArtifactForStorageMock.mock.calls[0]?.[0]?.rawContent;
    expect(rawContentArg).toContain("Uploader Notes:");
    expect(rawContentArg).toContain("Extracted File Text:");
    expect(addArtifactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        type: "Client Interview Notes",
      }),
    );
    expect(artifact.id).toBe("artifact-1");
  });

  it("persists artifacts even when summarization falls back to truncated text", async () => {
    summarizeArtifactForStorageMock.mockResolvedValue(
      "Truncated preview\n\n[Truncated preview of ~500 tokens. Re-upload smaller excerpts for full fidelity.]",
    );

    const file = new File([Buffer.from("file body")], "sample.md", {
      type: "text/markdown",
    });

    await ingestArtifactFile({
      projectId: "project-1",
      projectName: "Retail Performance Console",
      type: "Discovery Summary",
      file,
    });

    expect(addArtifactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Truncated preview of ~"),
      }),
    );
  });
});


