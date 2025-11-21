import fs from "node:fs/promises";
import path from "node:path";
import { File } from "node:buffer";

import type { Artifact, Project, ProjectDetail } from "@/lib/zod/estimates";
import { projectSchema } from "@/lib/zod/estimates";
import prisma from "@/lib/db";
import { ingestArtifactFile } from "./artifact-ingest";
import { estimatesService } from "../services/estimatesService";

const SAMPLES_ROOT = path.join(process.cwd(), "requirements", "samples");

/**
 * Default project metadata for the dev seed endpoint.
 *
 * The dev seed intentionally layers on top of whatever role catalog already
 * exists in the database. If you have run the Prisma seed, the canonical
 * roles from `lib/services/rolesConfig.ts` will be present; otherwise
 * `estimatesService.listRoles()` will ensure a minimal default set exists.
 */
export const DEV_SEED_DEFAULTS = {
  projectName: "Retail Performance Console (RPC)",
  clientName: "CloudRetailPro Ops",
};

interface SampleArtifactConfig {
  fileName: string;
  type: string;
  notes?: string;
}

export const SAMPLE_ARTIFACTS: SampleArtifactConfig[] = [
  {
    fileName: "sample-artifact1.md",
    type: "Client Interview Notes",
    notes: "Transcript from the consultant ↔ client kickoff conversation.",
  },
  {
    fileName: "sample-artifact2.md",
    type: "Discovery Summary",
    notes: "Bulletized goals, KPIs, integrations, and scope guardrails.",
  },
  {
    fileName: "sample-artifact3.md",
    type: "Background & Objectives",
    notes: "Project brief outlining objectives, constraints, and scale.",
  },
  {
    fileName: "sample-artifact4.md",
    type: "Operational Notes",
    notes: "Risks, API limits, UI expectations, and alerting preferences.",
  },
];

export interface SeedDevProjectOptions {
  projectName: string;
  clientName?: string | null;
  overwriteExisting?: boolean;
  returnDetails?: boolean;
}

export interface SeedDevProjectResult {
  projectId: string;
  project: ProjectDetail | null;
  artifacts: Artifact[];
  seededArtifacts: Array<{ type: string; fileName: string }>;
}

async function readSampleFile(fileName: string) {
  const absolutePath = path.join(SAMPLES_ROOT, fileName);
  const buffer = await fs.readFile(absolutePath);
  return new File([buffer], fileName, { type: "text/markdown" });
}

async function resetExistingProject(
  project: Project,
  projectName: string,
  clientName?: string | null,
) {
  await prisma.$transaction([
    prisma.artifact.deleteMany({ where: { projectId: project.id } }),
    prisma.businessCase.deleteMany({ where: { projectId: project.id } }),
    prisma.requirements.deleteMany({ where: { projectId: project.id } }),
    prisma.solutionArchitecture.deleteMany({ where: { projectId: project.id } }),
    prisma.quote.deleteMany({ where: { projectId: project.id } }),
    prisma.wBSItem.deleteMany({ where: { projectId: project.id } }),
    prisma.stageTransition.deleteMany({ where: { projectId: project.id } }),
  ]);

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      name: projectName,
      clientName: clientName ?? null,
      stage: "ARTIFACTS",
    },
  });

  return projectSchema.parse(updated);
}

async function resolveProject(options: SeedDevProjectOptions) {
  const existing = await prisma.project.findFirst({
    where: { name: options.projectName },
    orderBy: { createdAt: "desc" },
  });

  if (existing && options.overwriteExisting) {
    return resetExistingProject(existing, options.projectName, options.clientName);
  }

  if (!existing || options.overwriteExisting) {
    return estimatesService.createProject({
      name: options.projectName,
      clientName: options.clientName ?? null,
    });
  }

  // Otherwise create a new project to avoid clobbering prior seeded data.
  return estimatesService.createProject({
    name: `${options.projectName} (${Date.now().toString(36)})`,
    clientName: options.clientName ?? null,
  });
}

export async function seedDevProject(
  options: SeedDevProjectOptions,
): Promise<SeedDevProjectResult> {
  await estimatesService.listRoles();
  const project = await resolveProject(options);
  const artifacts: Artifact[] = [];

  for (const descriptor of SAMPLE_ARTIFACTS) {
    const file = await readSampleFile(descriptor.fileName);
    const artifact = await ingestArtifactFile({
      projectId: project.id,
      projectName: project.name,
      type: descriptor.type,
      notes: descriptor.notes,
      file,
    });
    artifacts.push(artifact);
  }

  const projectDetail = options.returnDetails
    ? await estimatesService.getProjectWithDetails(project.id)
    : null;

  return {
    projectId: project.id,
    project: projectDetail,
    artifacts,
    seededArtifacts: SAMPLE_ARTIFACTS.map((artifact) => ({
      type: artifact.type,
      fileName: artifact.fileName,
    })),
  };
}


