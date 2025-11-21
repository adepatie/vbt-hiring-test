import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mcp/providerClient", () => ({
  callProviderLLM: vi.fn(),
}));

import {
  ARTIFACT_PROMPT_TOKEN_LIMIT,
  prepareArtifactContentForPrompt,
  summarizeArtifactForStorage,
  hasSummaryProvenance,
} from "@/lib/server/artifact-summary";
import { callProviderLLM } from "@/lib/mcp/providerClient";

const callProviderLLMMock = vi.mocked(callProviderLLM);

function buildArtifact(content: string) {
  return {
    id: "artifact-1",
    type: "Requirements",
    originalName: "reqs.md",
    projectId: "project-1",
    content,
  } as any;
}

describe("prepareArtifactContentForPrompt", () => {
  beforeEach(() => {
    callProviderLLMMock.mockReset();
  });

  it("returns raw text when token estimate is under the threshold", async () => {
    const artifact = buildArtifact("Short discovery note.");

    const result = await prepareArtifactContentForPrompt({
      projectId: "project-1",
      projectName: "Project Atlas",
      artifact,
    });

    expect(result.isSummarized).toBe(false);
    expect(result.text).toBe("Short discovery note.");
    expect(callProviderLLMMock).not.toHaveBeenCalled();
  });

  it("summarizes artifacts that exceed the token threshold", async () => {
    const longText = "Insight ".repeat(ARTIFACT_PROMPT_TOKEN_LIMIT * 6);
    const artifact = buildArtifact(longText);

    callProviderLLMMock.mockResolvedValue({
      content: "Condensed summary content.",
      finishReason: "stop",
      raw: {},
    } as any);

    const result = await prepareArtifactContentForPrompt({
      projectId: "project-1",
      projectName: "Project Atlas",
      artifact,
    });

    expect(callProviderLLMMock).toHaveBeenCalled();
    expect(result.isSummarized).toBe(true);
    expect(result.text).toContain("Condensed summary content.");
    expect(result.text).toContain("Summary generated from ~");
  });
});

describe("summarizeArtifactForStorage", () => {
  const identity = { id: "artifact-1", type: "Requirements", originalName: "reqs.md" };
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  afterAll(() => {
    warnSpy.mockRestore();
  });

  beforeEach(() => {
    callProviderLLMMock.mockReset();
  });

  it("returns an LLM summary with attribution banner", async () => {
    callProviderLLMMock.mockResolvedValue({
      content: "Key requirements summary.",
      finishReason: "stop",
      raw: {},
    } as any);

    const result = await summarizeArtifactForStorage({
      projectId: "project-1",
      identity,
      rawContent: "Full artifact text goes here",
      projectName: "Project Atlas",
    });

    expect(callProviderLLMMock).toHaveBeenCalled();
    expect(result).toContain("Key requirements summary.");
    expect(result).toContain("AI-generated summary of uploaded artifact");
  });

  it("falls back to truncated text when summarization fails", async () => {
    callProviderLLMMock.mockRejectedValue(new Error("boom") as any);

    const result = await summarizeArtifactForStorage({
      projectId: "project-1",
      identity,
      rawContent: "Full artifact text goes here",
    });

    expect(result).toContain("Truncated preview of ~");
  });
});

describe("hasSummaryProvenance", () => {
  it("detects new-format summaries", () => {
    expect(
      hasSummaryProvenance("Summary body\n\n[AI-generated summary of uploaded artifact 'x']"),
    ).toBe(true);
  });

  it("returns false for legacy artifact content", () => {
    expect(hasSummaryProvenance("Legacy artifact text without banners")).toBe(false);
  });
});


