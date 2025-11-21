"use server";

import { contractsService } from "@/lib/services/contractsService";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { buildProposalId, saveReviewStateToDb } from "@/lib/server/contractReview";
import { Prisma } from "@prisma/client";

export async function createIncomingAgreementAction(formData: FormData) {
  const type = formData.get("type");
  const counterparty = formData.get("counterparty");
  const projectId = formData.get("projectId");
  const content = formData.get("content");

  if (!content || typeof content !== "string") {
    return { success: false, error: "Agreement content is required" };
  }
  
  if (!counterparty || typeof counterparty !== "string") {
      return { success: false, error: "Counterparty is required" };
  }
  
  if (!type || typeof type !== "string") {
      return { success: false, error: "Agreement type is required" };
  }

  try {
    const agreement = await prisma.agreement.create({
        data: {
            type: type as "MSA" | "SOW" | "NDA",
            counterparty: counterparty,
            projectId: projectId ? (projectId as string) : undefined,
            status: "REVIEW",
            versions: {
                create: {
                    versionNumber: 1,
                    content: content,
                    changeNote: "Incoming 1",
                }
            }
        }
    });

    revalidatePath("/contracts");
    return { success: true, agreementId: agreement.id };
  } catch (error) {
    console.error("Failed to create incoming agreement:", error);
    return { success: false, error: "Failed to create incoming agreement" };
  }
}

export async function saveReviewStateAction(agreementId: string, proposals: any[]) {
    try {
        await saveReviewStateToDb(agreementId, proposals);
        return { success: true };
    } catch (error) {
        console.error("Failed to save review state:", error);
        return { success: false, error: "Failed to save review state" };
    }
}

export async function getReviewStateAction(agreementId: string) {
    try {
        const agreement = await prisma.agreement.findUnique({
            where: { id: agreementId },
            include: {
                versions: {
                    orderBy: { versionNumber: 'asc' }, // v1 is first
                    take: 1
                }
            }
        });

        if (!agreement) return { success: false, error: "Agreement not found" };
        
        // Check if v1 exists for content
        const v1 = agreement.versions[0];
        if (!v1) return { success: false, error: "Version 1 content not found" };

        // Check if review data exists
        const reviewData = agreement.reviewData as any;
        const reviewDataExists = reviewData !== null && reviewData !== undefined;
        
        const storedProposals = (reviewData?.proposals as any[]) ?? [];
        const normalizedProposals = storedProposals.map((proposal, index) => ({
            ...proposal,
            id: proposal.id ?? buildProposalId(agreementId, index, proposal.originalText ?? "", proposal.proposedText ?? ""),
            decision: proposal.decision ?? "pending",
        }));

        return {
            success: true,
            data: {
                content: v1.content,
                proposals: normalizedProposals,
                reviewDataExists,
                type: agreement.type,
                counterparty: agreement.counterparty
            }
        };

    } catch (error) {
        console.error("Failed to get review state:", error);
        return { success: false, error: "Failed to get review state" };
    }
}

export async function saveReviewedVersionAction(agreementId: string, content: string, changeSummary: string) {
    if (!agreementId) {
        return { success: false, error: "Agreement ID is required" };
    }
    if (!content) {
        return { success: false, error: "Content is required" };
    }

    try {
        // Create new version (v2 usually)
        await contractsService.createVersion({
            agreementId,
            content,
            changeNote: changeSummary || "Applied policy review changes",
        });

        // Mark agreement as approved/finalized after review
        await contractsService.updateAgreementStatus({
            id: agreementId,
            status: "APPROVED"
        });
        
        // Clear review data on completion
        await prisma.agreement.update({
            where: { id: agreementId },
            data: { reviewData: Prisma.JsonNull }, // Clear it
        });

        revalidatePath(`/contracts/${agreementId}`);
        revalidatePath("/contracts");
        return { success: true };

    } catch (error) {
        console.error("Failed to save reviewed version:", error);
        return { success: false, error: "Failed to save reviewed version" };
    }
}
