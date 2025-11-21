import { NextResponse } from "next/server";
import { z } from "zod";

import { DEV_SEED_DEFAULTS, seedDevProject } from "@/lib/server/dev-seed";

const seedRequestSchema = z.object({
  projectName: z
    .string()
    .trim()
    .min(3, "Project name must be at least 3 characters.")
    .max(160, "Project name is too long.")
    .optional()
    .transform((value) => value?.trim() || DEV_SEED_DEFAULTS.projectName),
  clientName: z
    .string()
    .trim()
    .min(1, "Client name must not be empty.")
    .max(160, "Client name is too long.")
    .optional()
    .transform((value) => value?.trim() || DEV_SEED_DEFAULTS.clientName),
  overwriteExisting: z.boolean().optional().default(false),
  returnDetails: z.boolean().optional().default(true),
});

const isDevSeedEnabled = () =>
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_DEV_SEED_ENDPOINT === "true";

export async function POST(request: Request) {
  if (!isDevSeedEnabled()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let jsonBody: unknown = {};
  try {
    jsonBody = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
  }

  const parsed = seedRequestSchema.safeParse(jsonBody ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request payload." },
      { status: 400 },
    );
  }

  const body = parsed.data;

  try {
    const result = await seedDevProject({
      projectName: body.projectName,
      clientName: body.clientName,
      overwriteExisting: body.overwriteExisting,
      returnDetails: body.returnDetails,
    });

    return NextResponse.json(
      {
        message: "Seeded demo project with sample artifacts.",
        projectId: result.projectId,
        project: body.returnDetails ? result.project : undefined,
        seededArtifacts: result.seededArtifacts,
        artifactIds: result.artifacts.map((artifact) => artifact.id),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[dev-seed]", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to seed developer project.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}


