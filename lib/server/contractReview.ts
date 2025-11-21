import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { contractsService } from "@/lib/services/contractsService";
import {
  buildProposalId,
  computeFinalDraft,
  ProposalDecisionMap,
  ProposalTextChange,
} from "@/lib/contracts/proposalUtils";

const decisionSchema = z.enum(["accepted", "rejected", "pending"]);

const proposalSchema = z.object({
  id: z.string().min(1).optional(),
  originalText: z.string().min(1),
  proposedText: z.string().min(1),
  rationale: z.string().min(1),
  decision: decisionSchema.optional(),
});

const agreementIdSchema = z.string().cuid();

export type PersistedProposal = ProposalTextChange & {
  decision: "accepted" | "rejected" | "pending";
};

export async function saveReviewStateToDb(
  agreementId: string,
  proposals: unknown[],
): Promise<PersistedProposal[]> {
  const idResult = agreementIdSchema.safeParse(agreementId);
  if (!idResult.success) {
    throw new Error("Agreement ID required");
  }

  const proposalsResult = z.array(proposalSchema).safeParse(proposals ?? []);
  if (!proposalsResult.success) {
    throw new Error("Invalid proposal payload");
  }

  const normalized = proposalsResult.data.map((proposal, index) => {
    const id =
      proposal.id ??
      buildProposalId(
        idResult.data,
        index,
        proposal.originalText,
        proposal.proposedText,
      );
    return {
      ...proposal,
      id,
      decision: proposal.decision ?? "pending",
    };
  });

  const existing = await prisma.agreement.findUnique({
    where: { id: idResult.data },
    select: { reviewData: true },
  });

  const existingMap = new Map<string, any>();
  if (existing?.reviewData && typeof existing.reviewData === "object") {
    const prior = (existing.reviewData as { proposals?: any[] })?.proposals ?? [];
    for (const proposal of prior) {
      if (proposal?.id) {
        existingMap.set(proposal.id, proposal);
      }
    }
  }

  const merged = normalized.map((proposal) => {
    const previous = existingMap.get(proposal.id);
    return {
      ...proposal,
      decision: proposal.decision ?? previous?.decision ?? "pending",
    };
  });

  await prisma.agreement.update({
    where: { id: idResult.data },
    data: {
      reviewData: { proposals: merged },
    },
  });

  return merged as PersistedProposal[];
}

type ApplyProposalOptions = {
  agreementId: string;
  decisions?: ProposalDecisionMap;
  changeNote?: string;
  markApproved?: boolean;
};

export async function applyAcceptedProposalsToAgreement({
  agreementId,
  decisions,
  changeNote,
  markApproved = true,
}: ApplyProposalOptions) {
  const idResult = agreementIdSchema.safeParse(agreementId);
  if (!idResult.success) {
    throw new Error("Agreement ID required");
  }

  const agreement = await prisma.agreement.findUnique({
    where: { id: idResult.data },
    include: {
      versions: {
        orderBy: { versionNumber: "asc" },
        take: 1,
      },
    },
  });

  if (!agreement) {
    throw new Error(`Agreement ${idResult.data} not found.`);
  }

  const baseVersion = agreement.versions[0];
  if (!baseVersion || !baseVersion.content) {
    throw new Error("Unable to locate the original draft for this agreement.");
  }

  const storedProposals =
    ((agreement.reviewData as { proposals?: PersistedProposal[] } | null)?.proposals ??
      []).map((proposal, index) => ({
        ...proposal,
        id:
          proposal.id ??
          buildProposalId(
            idResult.data,
            index,
            proposal.originalText ?? "",
            proposal.proposedText ?? "",
          ),
        decision: proposal.decision ?? "pending",
      }));

  if (!storedProposals.length) {
    throw new Error("No proposals available to apply.");
  }

  const appliedDecisions: ProposalDecisionMap = decisions
    ? { ...decisions }
    : storedProposals.reduce<ProposalDecisionMap>((map, proposal) => {
        map[proposal.id] = proposal.decision ?? "pending";
        return map;
      }, {});

  const finalResult = computeFinalDraft({
    originalDraft: baseVersion.content,
    proposals: storedProposals,
    decisions: appliedDecisions,
  });

  if (finalResult.acceptedCount === 0) {
    throw new Error("No accepted proposals to apply.");
  }

  const summary =
    changeNote ??
    `${finalResult.acceptedCount} change${finalResult.acceptedCount === 1 ? "" : "s"} applied from policy review.`;

  const version = await contractsService.createVersion({
    agreementId: idResult.data,
    content: finalResult.finalContent,
    changeNote: summary,
  });

  if (markApproved) {
    await contractsService.updateAgreementStatus({
      id: idResult.data,
      status: "APPROVED",
    });
  }

  await prisma.agreement.update({
    where: { id: idResult.data },
    data: { reviewData: Prisma.JsonNull },
  });

  return {
    agreementId: idResult.data,
    version,
    finalContent: finalResult.finalContent,
    acceptedCount: finalResult.acceptedCount,
    changeNote: summary,
  };
}

