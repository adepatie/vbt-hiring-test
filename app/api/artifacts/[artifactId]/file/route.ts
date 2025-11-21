import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { resolveArtifactFilePath } from "@/lib/server/artifact-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  const { artifactId } = await params;
  try {
    const artifact = await prisma.artifact.findUnique({
      where: { id: artifactId },
    });

    if (!artifact || !artifact.storedFile) {
      return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
    }

    const filePath = resolveArtifactFilePath(artifact.storedFile);

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(filePath);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return NextResponse.json(
          { error: "Artifact file missing." },
          { status: 404 },
        );
      }
      throw error;
    }

    const downloadName =
      artifact.originalName ??
      `${artifact.type ?? "artifact"}${path.extname(artifact.storedFile)}`;

    return new NextResponse(new Blob([fileBuffer as any]), {
      status: 200,
      headers: {
        "Content-Type": artifact.mimeType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          downloadName,
        )}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[artifact-download]", error);
    return NextResponse.json(
      { error: "Unable to download artifact." },
      { status: 500 },
    );
  }
}

