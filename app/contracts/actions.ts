"use server";

import { contractsService } from "@/lib/services/contractsService";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

import { createAgreementSchema } from "@/lib/zod/contracts";
import {
  ContractGenerationOptions,
  generateContractDraftForAgreement,
  runPolicyReviewForDraft,
} from "@/lib/server/contractGeneration";

export async function createAgreementAction(input: unknown) {
  try {
    const data = createAgreementSchema.parse(input);

    // Validate project stage if linked
    if (data.projectId) {
        const project = await prisma.project.findUnique({
            where: { id: data.projectId },
            select: { stage: true }
        });

        if (!project || project.stage !== "QUOTE") {
            return { success: false, error: "Linked estimate must be at the Quote stage." };
        }
    }

    // 1. Create the Agreement record (starts with empty v1)
    const agreement = await contractsService.createAgreement(data);

    revalidatePath("/contracts");
    return { success: true, agreementId: agreement.id };
  } catch (error) {
    console.error("Failed to create agreement:", error);
    // Handle Zod errors specially if desired, but for now just generic
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to create agreement" 
    };
  }
}

export async function searchProjectsAction(query: string) {
  try {
    const projects = await prisma.project.findMany({
      where: {
        name: {
          contains: query,
          mode: "insensitive",
        },
        // Only allow projects that have reached the Quote stage
        stage: "QUOTE",
      },
      select: {
        id: true,
        name: true,
        clientName: true,
      },
      take: 10,
    });
    return projects;
  } catch (error) {
    console.error("Failed to search projects:", error);
    return [];
  }
}

export async function linkEstimateAction(agreementId: string, projectId: string) {
  try {
    // Validate project stage
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { stage: true }
    });

    if (!project || project.stage !== "QUOTE") {
        return { success: false, error: "Linked estimate must be at the Quote stage." };
    }

    await prisma.agreement.update({
      where: { id: agreementId },
      data: { projectId },
    });
    await contractsService.updateAgreementStatus({
      id: agreementId,
      status: "REVIEW",
    });
    
    revalidatePath(`/contracts/${agreementId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to link estimate:", error);
    return { success: false, error: "Failed to link estimate" };
  }
}

export async function listPoliciesAction() {
  try {
    return await contractsService.listPolicies();
  } catch (error) {
    console.error("Failed to list policies:", error);
    return [];
  }
}

export async function generateContractAction(
  agreementId: string,
  notes?: string,
  excludedPolicyIds?: string[],
  options?: ContractGenerationOptions,
) {
  console.log(
    `[generateContractAction] Starting generation for agreement ${agreementId} with notes: ${
      notes ? "yes" : "no"
    }, excludedPolicies: ${excludedPolicyIds?.length ?? 0}`,
  );

  const result = await generateContractDraftForAgreement({
    agreementId,
    instructions: notes,
    excludedPolicyIds,
    options,
  });

  if (result.success) {
    revalidatePath(`/contracts/${agreementId}`);
  }

  return result;
}

export async function alignAgreementWithEstimateAction(formData: FormData) {
  "use server";
  const agreementId = formData.get("agreementId");
  if (!agreementId || typeof agreementId !== "string") {
    throw new Error("Agreement ID is required");
  }

  const agreement = await contractsService.getAgreement(agreementId);
  if (!agreement) {
    throw new Error("Agreement not found");
  }
  if (agreement.type !== "SOW" || !agreement.projectId) {
    throw new Error("Alignment is only available for SOWs linked to an estimate");
  }

  const currentVersion = agreement.versions[0];
  if (!currentVersion?.content) {
    throw new Error("Agreement has no content to align");
  }

  await runPolicyReviewForDraft({
    agreementId,
    draftContent: currentVersion.content,
  });

  revalidatePath(`/contracts/${agreementId}`);
  redirect(`/contracts/${agreementId}?view=review`);
}
