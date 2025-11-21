import { describe, expect, it } from "vitest";

import { buildBusinessCasePrompt } from "@/lib/copilot/prompts/estimates";
import { buildRequirementsPrompt } from "@/lib/copilot/prompts/requirements";
import { buildQuoteTermsPrompt } from "@/lib/copilot/prompts/quote";

describe("estimates prompts", () => {
  it("buildBusinessCasePrompt falls back to artifacts digest when raw text missing", () => {
    const payload = buildBusinessCasePrompt({
      projectName: "Project Atlas",
      clientName: "Acme Corp",
      artifactsSummary: "Artifact 1: client brief\nArtifact 2: discovery notes",
    });

    expect(payload.systemPrompt).toContain("Estimates Copilot");
    expect(payload.messages).toHaveLength(1);
    const [message] = payload.messages;
    expect(message.role).toBe("user");
    expect(message.content).toContain("Project: Project Atlas");
    expect(message.content).toContain("Client: Acme Corp");
    expect(message.content).toContain("Artifacts digest");
  });

  it("buildBusinessCasePrompt includes the artifact text summary when provided", () => {
    const summaryText =
      "[Artifact 1: Note]\nThis is the raw text from the underlying artifact file.";

    const payload = buildBusinessCasePrompt({
      projectName: "Project Atlas",
      artifactsSummary: "Digest summary",
      artifactTextSummary: summaryText,
    });

    const [message] = payload.messages;
    expect(message.content).toContain(
      "Artifact text summary:\n[Artifact 1: Note]",
    );
    expect(message.content).toContain(
      "This is the raw text from the underlying artifact file.",
    );
    // It now includes both digest and content
    expect(message.content).toContain("Artifacts digest");
  });

  it("labels the artifact summary when it was truncated at the context limit", () => {
    const payload = buildBusinessCasePrompt({
      projectName: "Project Atlas",
      artifactsSummary: "Digest summary",
      artifactTextSummary: "[Artifact 1]\nTrimmed content",
      artifactTextSummaryTruncated: true,
    });

    const [message] = payload.messages;
    expect(message.content).toContain(
      "Artifact text summary (truncated at context limit):\n[Artifact 1]",
    );
  });

  it("enforces the 800-token limit in the business case instructions", () => {
    const payload = buildBusinessCasePrompt({
      projectName: "Project Atlas",
      artifactsSummary: "Digest summary",
    });

    const [message] = payload.messages;
    expect(message.content).toContain("under ~800 tokens");
  });

  it("buildRequirementsPrompt generates concise instructions", () => {
    const payload = buildRequirementsPrompt({
      projectName: "Project Atlas",
      artifactsSummary: "Digest summary",
      businessCaseDraft: "Business case content",
    });

    const [message] = payload.messages;
    expect(message.content).toContain("Project: Project Atlas");
    expect(message.content).toContain("Artifacts digest:\nDigest summary");
    expect(message.content).toContain("Business Case draft:\nBusiness case content");
    expect(message.content).toContain("Generate a concise requirements summary");
    expect(message.content).toContain("under ~600 words");
  });

  it("buildQuoteTermsPrompt enforces milestone-style payment terms", () => {
    const payload = buildQuoteTermsPrompt({
      projectName: "Project Atlas",
      subtotal: 10000,
      overheadFee: 1000,
      total: 11000,
      wbsSummary: "Task 1: 10h",
    });

    const [message] = payload.messages;
    expect(message.content).toContain("milestone-style format");
    expect(message.content).toContain("40% on signing");
    expect(message.content).toContain("Ensure percentages sum to 100%");
  });
});


