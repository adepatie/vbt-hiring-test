"use server";

import { revalidatePath } from "next/cache";
import type { EstimateStage, WbsItemInput } from "@/lib/zod/estimates";
import { estimatesService } from "@/lib/services/estimatesService";
import { copilotActions } from "@/lib/copilot/actions";

const ESTIMATES_LIST_PATH = "/estimates";
const projectPath = (projectId: string) => `/estimates/${projectId}`;

const revalidateProject = (projectId: string, includeList = false) => {
  revalidatePath(projectPath(projectId));
  revalidatePath(`${projectPath(projectId)}/flow`);
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
  overheadFee?: number | null;
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
  originalName?: string | null;
  storedFile?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
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
    { allowMassDelete: true },
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

  // When moving from Artifacts to Business Case, immediately ask Copilot to
  // generate a draft based on the current artifacts. This runs on the server
  // so the client does not need to make a separate HTTP call.
  if (args.targetStage === "BUSINESS_CASE") {
    try {
      await copilotActions.generateBusinessCaseFromArtifacts({
        projectId: args.projectId,
      });
    } catch (error) {
      // Revalidate the project so the UI still reflects the new stage even if
      // Copilot failed, then surface a clear error up to the client.
      revalidateProject(args.projectId, true);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        "Copilot failed to generate the Business Case from artifacts.",
      );
    }
  }

  if (args.targetStage === "REQUIREMENTS") {
    try {
      await copilotActions.generateRequirementsFromBusinessCase({
        projectId: args.projectId,
      });
    } catch (error) {
      revalidateProject(args.projectId, true);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        "Copilot failed to generate Requirements from the Business Case.",
      );
    }
  }

  if (args.targetStage === "SOLUTION") {
    try {
      await copilotActions.generateSolutionArchitectureFromRequirements({
        projectId: args.projectId,
      });
    } catch (error) {
      revalidateProject(args.projectId, true);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        "Copilot failed to generate the Solution Architecture from Requirements.",
      );
    }
  }

  if (args.targetStage === "EFFORT") {
    try {
      await copilotActions.generateEffortFromSolution({
        projectId: args.projectId,
      });
    } catch (error) {
      revalidateProject(args.projectId, true);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        "Copilot failed to generate Effort (WBS) items from the Solution draft.",
      );
    }
  }

  revalidateProject(args.projectId, true);
  return project;
}


