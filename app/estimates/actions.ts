"use server";

import { revalidatePath } from "next/cache";
import type { EstimateStage, WbsItemInput } from "@/lib/zod/estimates";
import { estimatesService } from "@/lib/services/estimatesService";

const ESTIMATES_LIST_PATH = "/estimates";
const projectPath = (projectId: string) => `/estimates/${projectId}`;

const revalidateProject = (projectId: string, includeList = false) => {
  revalidatePath(projectPath(projectId));
  if (includeList) {
    revalidatePath(ESTIMATES_LIST_PATH);
  }
};

type CreateProjectArgs = {
  name: string;
  clientName?: string | null;
};

export async function createProjectAction(args: CreateProjectArgs) {
  const project = await estimatesService.createProject(args);
  revalidatePath(ESTIMATES_LIST_PATH);
  return project;
}

type UpdateProjectMetadataArgs = {
  projectId: string;
  name?: string;
  clientName?: string | null;
};

export async function updateProjectMetadataAction(
  args: UpdateProjectMetadataArgs,
) {
  const project = await estimatesService.updateProjectMetadata(args);
  revalidateProject(project.id, true);
  return project;
}

type SaveStageContentArgs = {
  projectId: string;
  stage: EstimateStage;
  content: string;
  approved?: boolean;
};

export async function saveStageContentAction(args: SaveStageContentArgs) {
  const record = await estimatesService.saveStageContent(args);
  revalidateProject(args.projectId);
  return record;
}

type SaveQuoteArgs = {
  projectId: string;
  rates?: Record<string, number> | null;
  paymentTerms?: string | null;
  timeline?: string | null;
  total?: number | null;
  delivered?: boolean;
};

export async function saveQuoteAction(args: SaveQuoteArgs) {
  const quote = await estimatesService.saveQuote(args);
  revalidateProject(args.projectId);
  return quote;
}

type AddArtifactArgs = {
  projectId: string;
  type: string;
  content?: string | null;
  url?: string | null;
};

export async function addArtifactAction(args: AddArtifactArgs) {
  const artifact = await estimatesService.addArtifact(args);
  revalidateProject(args.projectId);
  return artifact;
}

export async function removeArtifactAction(
  projectId: string,
  artifactId: string,
) {
  await estimatesService.removeArtifact(projectId, artifactId);
  revalidateProject(projectId);
}

type UpdateWbsItemsArgs = {
  projectId: string;
  items: WbsItemInput[];
};

export async function updateWbsItemsAction(args: UpdateWbsItemsArgs) {
  const items = await estimatesService.updateWbsItems(
    args.projectId,
    args.items,
  );
  revalidateProject(args.projectId);
  return items;
}

type AdvanceStageArgs = {
  projectId: string;
  targetStage: EstimateStage;
};

export async function advanceStageAction(args: AdvanceStageArgs) {
  const project = await estimatesService.advanceStage(
    args.projectId,
    args.targetStage,
  );
  revalidateProject(args.projectId, true);
  return project;
}


