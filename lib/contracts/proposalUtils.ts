export type ProposalDecision = "accepted" | "rejected" | "pending";

export interface ProposalTextChange {
  id: string;
  originalText: string;
  proposedText: string;
  rationale?: string;
  decision?: ProposalDecision;
}

export type ProposalDecisionMap = Record<string, ProposalDecision | undefined>;

export type ProposalSegment =
  | { type: "text"; content: string }
  | { type: "proposal"; proposal: ProposalTextChange; matchedText: string };

export const ORIGINAL_SNIPPET_LIMIT = 200;
export const PROPOSED_SNIPPET_LIMIT = 80;

const normalizeSnippet = (value: string, limit: number) =>
  value.replace(/\s+/g, " ").trim().slice(0, limit);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildWhitespaceFlexiblePattern = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  return normalized
    .split(" ")
    .map((token) => escapeRegex(token))
    .join("\\s+");
};

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

export function findProposalMatch(
  fullText: string,
  originalText: string,
  fromIndex: number,
) {
  if (!originalText || !originalText.length) {
    return null;
  }

  const exactIndex = fullText.indexOf(originalText, fromIndex);
  if (exactIndex !== -1) {
    return { index: exactIndex, matchedText: originalText };
  }

  const flexiblePattern = buildWhitespaceFlexiblePattern(originalText);
  if (!flexiblePattern) {
    return null;
  }

  const regex = new RegExp(flexiblePattern, "i");
  const slice = fullText.slice(fromIndex);
  const match = regex.exec(slice);

  if (!match || typeof match.index !== "number") {
    return null;
  }

  const index = fromIndex + match.index;
  const matchedText = fullText.slice(index, index + match[0].length);

  return { index, matchedText };
}

export function segmentProposalDocument(
  originalDraft: string,
  proposals: ProposalTextChange[],
): { segments: ProposalSegment[]; unmatchedProposals: ProposalTextChange[] } {
  if (!originalDraft) {
    return {
      segments: [],
      unmatchedProposals: proposals,
    };
  }

  if (!proposals.length) {
    return {
      segments: [{ type: "text", content: originalDraft }],
      unmatchedProposals: [],
    };
  }

  const sortedProposals = [...proposals].sort((a, b) => {
    const idxA = originalDraft.indexOf(a.originalText);
    const idxB = originalDraft.indexOf(b.originalText);
    return idxA - idxB;
  });

  const segments: ProposalSegment[] = [];
  const unmatched: ProposalTextChange[] = [];
  let lastIndex = 0;

  for (const proposal of sortedProposals) {
    const match = findProposalMatch(originalDraft, proposal.originalText, lastIndex);

    if (!match) {
      unmatched.push(proposal);
      continue;
    }

    const { index, matchedText } = match;

    if (index > lastIndex) {
      segments.push({
        type: "text",
        content: originalDraft.slice(lastIndex, index),
      });
    }

    segments.push({
      type: "proposal",
      proposal,
      matchedText,
    });

    lastIndex = index + matchedText.length;
  }

  if (lastIndex < originalDraft.length) {
    segments.push({
      type: "text",
      content: originalDraft.slice(lastIndex),
    });
  }

  return { segments, unmatchedProposals: unmatched };
}

export function computeFinalDraft({
  originalDraft,
  proposals,
  decisions,
  segments: precomputedSegments,
  unmatchedProposals: precomputedUnmatched,
}: {
  originalDraft: string;
  proposals: ProposalTextChange[];
  decisions?: ProposalDecisionMap;
  segments?: ProposalSegment[];
  unmatchedProposals?: ProposalTextChange[];
}) {
  const decisionMap: ProposalDecisionMap = decisions
    ? { ...decisions }
    : proposals.reduce<ProposalDecisionMap>((map, proposal) => {
        map[proposal.id] = proposal.decision ?? "pending";
        return map;
      }, {});

  let segments = precomputedSegments;
  let unmatchedProposals = precomputedUnmatched;

  if (!segments || !segments.length) {
    const result = segmentProposalDocument(originalDraft, proposals);
    segments = result.segments;
    unmatchedProposals = result.unmatchedProposals;
  }

  if (!segments) {
    segments = [];
  }
  if (!unmatchedProposals) {
    unmatchedProposals = [];
  }

  const finalContent = segments
    .map((segment) => {
      if (segment.type === "text") return segment.content;
      const decision =
        decisionMap[segment.proposal.id] ?? segment.proposal.decision ?? "pending";
      if (decision === "accepted") {
        return segment.proposal.proposedText;
      }
      return segment.matchedText;
    })
    .join("");

  const acceptedCount = Object.values(decisionMap).filter(
    (decision) => decision === "accepted",
  ).length;

  return {
    finalContent,
    segments,
    unmatchedProposals,
    acceptedCount,
  };
}


