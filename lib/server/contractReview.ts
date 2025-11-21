import { prisma } from "@/lib/db";
import { z } from "zod";

const ORIGINAL_SNIPPET_LIMIT = 200;
const PROPOSED_SNIPPET_LIMIT = 80;

const decisionSchema = z.enum(["accepted", "rejected", "pending"]);

const proposalSchema = z.object({
  id: z.string().min(1).optional(),
  originalText: z.string().min(1),
  proposedText: z.string().min(1),
  rationale: z.string().min(1),
  decision: decisionSchema.optional(),
});

const agreementIdSchema = z.string().cuid();

const normalizeSnippet = (value: string, limit: number) =>
  value.replace(/\s+/g, " ").trim().slice(0, limit);

const fnv1aHash = (value: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return (hash >>> 0).toString(16);
};

export const buildProposalId = (
  agreementId: string,
  index: number,
  originalText: string,
  proposedText: string,
) => {
  const payload = `${agreementId}:${index}:${normalizeSnippet(originalText, ORIGINAL_SNIPPET_LIMIT)}:${normalizeSnippet(proposedText, PROPOSED_SNIPPET_LIMIT)}`;
  return `prop_${fnv1aHash(payload)}`;
};

export type PersistedProposal = {
  id: string;
  originalText: string;
  proposedText: string;
  rationale: string;
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

