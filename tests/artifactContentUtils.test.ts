import { describe, expect, it } from "vitest";

import {
  describeArtifactContent,
  getArtifactContentVariant,
} from "@/lib/utils/artifacts";

describe("artifact content helpers", () => {
  it("detects AI-generated summaries", () => {
    const sample =
      "Summary body\n\n[AI-generated summary of uploaded artifact 'Discovery Notes']";

    expect(getArtifactContentVariant(sample)).toBe("summary");
    expect(describeArtifactContent(sample)).toEqual({
      variant: "summary",
      label: "AI-generated summary",
      helperText: null,
    });
  });

  it("detects truncated previews", () => {
    const sample =
      "Preview body\n\n[Truncated preview of ~500 tokens. Re-upload smaller excerpts for full fidelity.]";

    expect(getArtifactContentVariant(sample)).toBe("preview");
    expect(describeArtifactContent(sample)).toEqual({
      variant: "preview",
      label: "Extracted text preview",
      helperText: "File was too large to summarize; showing truncated source text.",
    });
  });

  it("treats legacy artifacts as raw text", () => {
    const sample = "Legacy artifact body without provenance marker.";

    expect(getArtifactContentVariant(sample)).toBe("raw");
    expect(describeArtifactContent(sample)).toEqual({
      variant: "raw",
      label: "Artifact text",
      helperText: "Artifact predates summaries; showing captured text verbatim.",
    });
  });

  it("returns null metadata when content is empty", () => {
    expect(getArtifactContentVariant("")).toBeNull();
    expect(describeArtifactContent(null)).toEqual({
      variant: null,
      label: null,
      helperText: null,
    });
  });
});


