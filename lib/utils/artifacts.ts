const SUMMARY_MARKER = "[AI-generated summary";
const TRUNCATED_PREVIEW_MARKER = "[Truncated preview";

export type ArtifactContentVariant = "summary" | "preview" | "raw";

export type ArtifactContentDescription = {
  variant: ArtifactContentVariant | null;
  label: string | null;
  helperText: string | null;
};

export function getArtifactContentVariant(
  content?: string | null,
): ArtifactContentVariant | null {
  if (!content?.trim()) {
    return null;
  }
  if (content.includes(TRUNCATED_PREVIEW_MARKER)) {
    return "preview";
  }
  if (content.includes(SUMMARY_MARKER)) {
    return "summary";
  }
  return "raw";
}

export function describeArtifactContent(
  content?: string | null,
): ArtifactContentDescription {
  const variant = getArtifactContentVariant(content);

  switch (variant) {
    case "summary":
      return {
        variant,
        label: "AI-generated summary",
        helperText: null,
      };
    case "preview":
      return {
        variant,
        label: "Extracted text preview",
        helperText: "File was too large to summarize; showing truncated source text.",
      };
    case "raw":
      return {
        variant,
        label: "Artifact text",
        helperText: "Artifact predates summaries; showing captured text verbatim.",
      };
    default:
      return {
        variant,
        label: null,
        helperText: null,
      };
  }
}


