import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const ARTIFACT_RELATIVE_ROOT = path.join("uploads", "artifacts");
const ARTIFACT_ABSOLUTE_ROOT = path.join(process.cwd(), ARTIFACT_RELATIVE_ROOT);

const EXTENSION_MIME_MAP: Record<string, string> = {
  ".txt": "text/plain",
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".md": "text/markdown",
};

export const ALLOWED_ARTIFACT_EXTENSIONS = Object.keys(EXTENSION_MIME_MAP);

const sanitizeFileStem = (name: string) => {
  const parsed = path.parse(name);
  const base = parsed.name || "artifact";
  return base
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
    .toLowerCase();
};

export class ArtifactStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactStorageError";
  }
}

const ensureDirectory = async (filePath: string) => {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
};

const isExtensionAllowed = (extension: string) =>
  ALLOWED_ARTIFACT_EXTENSIONS.includes(extension.toLowerCase());

export const resolveArtifactFilePath = (storedFile: string) =>
  path.join(ARTIFACT_ABSOLUTE_ROOT, storedFile);

export type SavedArtifactFile = {
  storedFile: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

export async function saveArtifactFile(
  projectId: string,
  file: File,
): Promise<SavedArtifactFile> {
  if (!(file instanceof File)) {
    throw new ArtifactStorageError("A file upload is required.");
  }

  if (file.size === 0) {
    throw new ArtifactStorageError("The uploaded file is empty.");
  }

  const extension = path.extname(file.name).toLowerCase();
  if (!isExtensionAllowed(extension)) {
    throw new ArtifactStorageError(
      `Unsupported file type. Allowed extensions: ${ALLOWED_ARTIFACT_EXTENSIONS.join(
        ", ",
      )}.`,
    );
  }

  const filenameStem = sanitizeFileStem(file.name);
  const uniqueSuffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const finalFileName = `${filenameStem || "artifact"}-${uniqueSuffix}${extension}`;
  const storedFile = path.posix.join(projectId, finalFileName);
  const absolutePath = resolveArtifactFilePath(storedFile);

  await ensureDirectory(absolutePath);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  const mimeType =
    file.type && file.type.length > 0
      ? file.type
      : EXTENSION_MIME_MAP[extension] ?? "application/octet-stream";

  return {
    storedFile,
    originalName: file.name,
    mimeType,
    sizeBytes: buffer.byteLength,
  };
}

export async function deleteArtifactFile(storedFile?: string | null) {
  if (!storedFile) {
    return;
  }

  const absolutePath = resolveArtifactFilePath(storedFile);

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return;
    }
    throw new ArtifactStorageError(
      `Unable to delete artifact file ${storedFile}.`,
    );
  }
}

