import fs from "node:fs/promises";
import path from "node:path";

const normalizeText = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    // Collapse more than 3 consecutive newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export async function extractArtifactText(
  absolutePath: string,
  opts: { extension?: string; mimeType?: string },
): Promise<string> {
  const ext =
    opts.extension?.toLowerCase() ?? path.extname(absolutePath).toLowerCase();

  try {
    if (ext === ".txt" || ext === ".md") {
      const raw = await fs.readFile(absolutePath, "utf8");
      return normalizeText(raw);
    }

    const buffer = await fs.readFile(absolutePath);

    if (ext === ".pdf") {
      const pdfParse = (await import("pdf-parse")).default as (
        dataBuffer: Buffer,
      ) => Promise<{ text: string }>;

      const result = await pdfParse(buffer);
      return normalizeText(result.text ?? "");
    }

    if (ext === ".docx") {
      const mammothModule = await import("mammoth");
      const { value } = await (mammothModule as any).extractRawText({ buffer });
      return normalizeText(value ?? "");
    }
  } catch (error) {
    console.warn(
      "[artifact-text] Failed to extract text from artifact:",
      absolutePath,
      error,
    );
  }

  return "";
}


