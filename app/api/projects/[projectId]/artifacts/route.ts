import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ArtifactStorageError } from "@/lib/server/artifact-storage";
import { estimatesService } from "@/lib/services/estimatesService";
import { ingestArtifactFile } from "@/lib/server/artifact-ingest";

const formSchema = z.object({
  type: z
    .string()
    .trim()
    .min(2, "Type is required.")
    .max(120, "Type is too long."),
  notes: z
    .string()
    .trim()
    .max(20000, "Notes are too long.")
    .optional()
    .transform((value) => (value && value.length ? value : undefined)),
});

const revalidateProjectPaths = (projectId: string) => {
  revalidatePath(`/estimates/${projectId}`);
  revalidatePath(`/estimates/${projectId}/flow`);
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  try {
    const formData = await request.formData();
    const typeValue = formData.get("type");
    const notesValue = formData.get("notes");
    const file = formData.get("file");

    const parsed = formSchema.safeParse({
      type: typeof typeValue === "string" ? typeValue : "",
      notes: typeof notesValue === "string" ? notesValue : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "A .txt, .pdf, .docx, or .md file is required." },
        { status: 400 },
      );
    }

    const project = await estimatesService.getProjectMetadata(projectId);

    const artifact = await ingestArtifactFile({
      projectId,
      projectName: project.name,
      type: parsed.data.type,
      notes: parsed.data.notes,
      file,
    });

    revalidateProjectPaths(projectId);

    return NextResponse.json({ artifact }, { status: 201 });
  } catch (error) {
    console.error("[artifact-upload]", error);
    if (error instanceof ArtifactStorageError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

