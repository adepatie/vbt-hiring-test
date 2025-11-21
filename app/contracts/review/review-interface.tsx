"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Wand2, Check, ArrowRight, Loader2, X, AlertTriangle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCopilotAction } from "@/lib/copilot/hooks";
import { toast } from "sonner";
import { createIncomingAgreementAction, saveReviewedVersionAction, saveReviewStateAction, getReviewStateAction } from "./actions";
import { PolicyOverrideSelector } from "../components/policy-override-selector";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Proposal {
  originalText: string;
  proposedText: string;
  rationale: string;
  id: string;
  decision?: Decision;
}

type Decision = "accepted" | "rejected" | "pending";

const ORIGINAL_SNIPPET_LIMIT = 200;
const PROPOSED_SNIPPET_LIMIT = 80;

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

const buildProposalId = (
  agreementId: string,
  index: number,
  originalText: string,
  proposedText: string,
) => {
  const payload = `${agreementId}:${index}:${normalizeSnippet(originalText, ORIGINAL_SNIPPET_LIMIT)}:${normalizeSnippet(proposedText, PROPOSED_SNIPPET_LIMIT)}`;
  return `prop_${fnv1aHash(payload)}`;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildWhitespaceFlexiblePattern = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  return normalized
    .split(" ")
    .map((token) => escapeRegex(token))
    .join("\\s+");
};

const findProposalMatch = (fullText: string, originalText: string, fromIndex: number) => {
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
};

type DocumentSegment =
  | { type: "text"; content: string }
  | { type: "proposal"; proposal: Proposal; matchedText: string };

interface ReviewInterfaceProps {
  agreementId?: string;
  variant?: "standalone" | "embedded";
}

export default function ReviewInterface({ agreementId, variant = "standalone" }: ReviewInterfaceProps) {
  const searchParams = useSearchParams();
  const paramAgreementId = searchParams.get("agreementId");
  const effectiveAgreementId = agreementId || paramAgreementId;
  const isEmbedded = variant === "embedded";
  const hasRedirectedRef = useRef(false);

  // Input State
  const [draftText, setDraftText] = useState("");
  const [agreementType, setAgreementType] = useState<string>("MSA");
  const [counterparty, setCounterparty] = useState("");
  const [excludedPolicyIds, setExcludedPolicyIds] = useState<string[]>([]);
  const [isLoadingState, setIsLoadingState] = useState(false);
  
  // Review State
  const [isStartingReview, setIsStartingReview] = useState(false);
  const [currentAgreementId, setCurrentAgreementId] = useState<string | null>(effectiveAgreementId || null);
  const [originalDraft, setOriginalDraft] = useState(""); // Immutable v1 text
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [reviewPerformed, setReviewPerformed] = useState(false);
  
  // Decisions State: Map of Proposal ID -> Decision
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  
  const router = useRouter();

  useEffect(() => {
    if (
      variant === "standalone" &&
      currentAgreementId &&
      (proposals.length > 0 || reviewPerformed) &&
      !hasRedirectedRef.current
    ) {
      hasRedirectedRef.current = true;
      router.replace(`/contracts/${currentAgreementId}?view=review`);
    }
  }, [variant, currentAgreementId, proposals.length, reviewPerformed, router]);

  // Effect to load existing state if resuming
  useEffect(() => {
    if (effectiveAgreementId) {
        const loadState = async () => {
            setIsLoadingState(true);
            try {
                const result = await getReviewStateAction(effectiveAgreementId);
                if (result.success && result.data) {
                    setOriginalDraft(result.data.content);
                    setDraftText(result.data.content); // also populate input just in case
                    setAgreementType(result.data.type);
                    setCounterparty(result.data.counterparty);
                    setReviewPerformed(!!result.data.reviewDataExists);
                    
                    if (result.data.proposals && result.data.proposals.length > 0) {
                        const baseId = effectiveAgreementId ?? "local";
                        const loadedProposals: Proposal[] = result.data.proposals.map((p: any, idx: number) => {
                            const proposalId =
                                p.id ??
                                buildProposalId(
                                    baseId,
                                    idx,
                                    p.originalText ?? "",
                                    p.proposedText ?? "",
                                );

                            return {
                                ...p,
                                id: proposalId,
                                decision: p.decision ?? "pending",
                            };
                        });
                        setProposals(loadedProposals);
                        
                        const initialDecisions: Record<string, Decision> = {};
                        loadedProposals.forEach((p) => {
                            initialDecisions[p.id] = p.decision || "pending";
                        });
                        setDecisions(initialDecisions);
                    } else if (result.data.reviewDataExists) {
                        // Review was performed but found no issues
                        setProposals([]);
                    }
                }
            } catch (e) {
                console.error("Failed to load review state", e);
                toast.error("Failed to load existing review.");
            } finally {
                setIsLoadingState(false);
            }
        };
        loadState();
    }
  }, [effectiveAgreementId]);

  const { run: reviewDraft, isLoading: isReviewing } = useCopilotAction(
    "contracts.reviewDraft",
    {
      onError: (error) => {
        toast.error("Review failed", { description: error.message });
      },
    }
  );

  const handleStartReview = async () => {
    if (!draftText.trim()) return;
    // If we already have an agreement ID (resuming), we don't need counterparty/type if they are already set
    // But for simplicity, let's require them if creating new.
    
    if (!currentAgreementId && !counterparty.trim()) {
        toast.error("Please enter a counterparty name.");
        return;
    }
    
    setIsStartingReview(true);

    try {
        let targetId = currentAgreementId;
        
        if (!targetId) {
            // 1. Create Agreement & Version 1
            const formData = new FormData();
            formData.append("type", agreementType);
            formData.append("counterparty", counterparty);
            formData.append("content", draftText);
            
            const result = await createIncomingAgreementAction(formData);
            
            if (!result.success || !result.agreementId) {
                throw new Error(result.error || "Failed to create agreement record");
            }
            targetId = result.agreementId;
        }

        setCurrentAgreementId(targetId);
        setOriginalDraft(draftText); // Lock in the original text

        // 2. Run Analysis
        const result = await reviewDraft({
            agreementId: targetId,
            agreementType: agreementType, // If resuming, this might need to come from DB
            incomingDraft: draftText,
            excludedPolicyIds,
        });

        try {
          const parsed = JSON.parse(result.content);
          if (parsed.proposals && Array.isArray(parsed.proposals)) {
            const baseId = targetId ?? "local";
            const proposalsWithIds: Proposal[] = parsed.proposals.map(
              (p: any, idx: number) => {
                const proposalId = buildProposalId(
                  baseId,
                  idx,
                  p.originalText ?? "",
                  p.proposedText ?? "",
                );
                return {
                  ...p,
                  id: proposalId,
                  decision: decisions[proposalId] ?? "pending",
                };
              },
            );
            setProposals(proposalsWithIds);
            setReviewPerformed(true);
            
            const nextDecisions: Record<string, Decision> = {};
            proposalsWithIds.forEach((p) => {
                nextDecisions[p.id] = p.decision || "pending";
            });
            setDecisions(nextDecisions);

            if (targetId) {
                await saveReviewStateAction(targetId, proposalsWithIds);
            }

            if (proposalsWithIds.length > 0) {
                toast.success(`Review complete. ${proposalsWithIds.length} issues found.`);
            } else {
                toast.success("Review complete. No issues found.");
            }
          } else {
            toast.error("Invalid response format from Copilot.");
          }
        } catch (e) {
          toast.error("Failed to parse review response.");
        }

    } catch (error) {
        toast.error("Failed to start review", { description: (error as Error).message });
    } finally {
        setIsStartingReview(false);
    }
  };

  async function makeDecision(proposalId: string, decision: Decision) {
    // Optimistic update
    setDecisions(prev => ({
        ...prev,
        [proposalId]: decision
    }));

    // Update proposals state to include decision
    const updatedProposals = proposals.map(p => 
        p.id === proposalId ? { ...p, decision } : p
    );
    setProposals(updatedProposals);

    // Persist to server
    if (currentAgreementId) {
        // We don't await here to keep UI snappy, but we catch errors
        saveReviewStateAction(currentAgreementId, updatedProposals).catch(err => {
             console.error("Failed to save decision", err);
             // Silent fail or toast? Silent for now to avoid spam
        });
    }
  }

  // Segmentation Logic
  // We split the original text into segments: "text" (unchanged) or "proposal" (needs diff view)
  const { segments, unmatchedProposals } = useMemo<{
    segments: DocumentSegment[];
    unmatchedProposals: Proposal[];
  }>(() => {
    if (!originalDraft) {
        return {
            segments: [],
            unmatchedProposals: proposals,
        };
    }

    if (proposals.length === 0) {
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

    const segs: DocumentSegment[] = [];
    const unmatched: Proposal[] = [];
    let lastIndex = 0;

    for (const proposal of sortedProposals) {
        const match = findProposalMatch(originalDraft, proposal.originalText, lastIndex);

        if (!match) {
            unmatched.push(proposal);
            continue;
        }

        const { index, matchedText } = match;

        if (index > lastIndex) {
            segs.push({
                type: "text",
                content: originalDraft.slice(lastIndex, index),
            });
        }

        segs.push({
            type: "proposal",
            proposal,
            matchedText,
        });

        lastIndex = index + matchedText.length;
    }

    if (lastIndex < originalDraft.length) {
        segs.push({
            type: "text",
            content: originalDraft.slice(lastIndex),
        });
    }

    return { segments: segs, unmatchedProposals: unmatched };
  }, [originalDraft, proposals]);

  function computeFinalDraft(): string {
      let final = originalDraft;
      
      // Filter for accepted proposals ONLY
      const acceptedList = proposals.filter(p => decisions[p.id] === "accepted");
      
      // Apply replacements
      // Note: Replacing sequentially in the original string is tricky if we don't handle indices.
      // But since we are replacing 'originalText' which comes from the source, 
      // AND assuming we replace them in order of occurrence (or just globally if unique),
      // we need to be careful.
      
      // Robust approach: Reconstruct from segments.
      // If we use the segments derived above, we can just map them to string.
      
      return segments.map(seg => {
          if (seg.type === "text") return seg.content;
          if (seg.type === "proposal") {
              if (decisions[seg.proposal.id] === "accepted") {
                  return seg.proposal.proposedText;
              }
              return seg.matchedText;
          }
          return "";
      }).join("");
  }

  async function handleConfirmChanges() {
    if (!currentAgreementId) return;
    
    const finalContent = computeFinalDraft();
    const changeCount = Object.values(decisions).filter(d => d === "accepted").length;
    const summary = `${changeCount} change${changeCount === 1 ? '' : 's'} applied from policy review.`;

    toast.promise(
        saveReviewedVersionAction(currentAgreementId, finalContent, summary),
        {
            loading: "Saving new version...",
            success: () => {
                router.refresh();
                router.push(`/contracts/${currentAgreementId}`);
                return "Agreement finalized and saved.";
            },
            error: "Failed to save version."
        }
    );
  }

  if (isLoadingState) {
      return (
          <div className={cn(
            "flex items-center justify-center",
            isEmbedded ? "h-full" : "h-[calc(100vh-10rem)]"
          )}>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
      );
  }

  if (proposals.length > 0 || reviewPerformed) {
    const pendingCount = Object.values(decisions).filter(d => d === "pending").length;
    const acceptedCount = Object.values(decisions).filter(d => d === "accepted").length;

    return (
      <div className={cn(
        "flex flex-col gap-4",
        isEmbedded ? "h-full" : "h-[calc(100vh-10rem)]"
      )}>
        {/* Header / Stats */}
        <Card className="shrink-0">
            <div className="flex items-center justify-between p-4">
                <div className="flex gap-4 items-center">
                    <h2 className="text-lg font-semibold">Review Agreement</h2>
                    <div className="flex gap-2">
                        <Badge variant="outline">{proposals.length} Issues</Badge>
                        <Badge variant="secondary" className="text-amber-600 border-amber-200 bg-amber-50">
                            {pendingCount} Pending
                        </Badge>
                        <Badge variant="secondary" className="text-green-600 border-green-200 bg-green-50">
                            {acceptedCount} Accepted
                        </Badge>
                    </div>
                </div>
                <Button onClick={handleConfirmChanges}>
                    Confirm Changes & Save
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </Card>

        {/* Document View */}
        <Card className="flex-1 overflow-hidden flex flex-col">
          <CardHeader className="py-3 border-b bg-muted/5">
             <CardTitle className="text-sm font-medium text-muted-foreground">
                Document Preview (Redline Mode)
             </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1 p-8">
            <div className="max-w-3xl mx-auto whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {segments.map((seg, idx) => {
                    if (seg.type === "text") {
                        return <span key={idx} className="text-foreground/80">{seg.content}</span>;
                    }
                    
                    if (seg.type === "proposal") {
                        const p = seg.proposal;
                        const decision = decisions[p.id];
                        const originalDisplay = seg.matchedText ?? p.originalText;

                        return (
                            <TooltipProvider key={idx}>
                                <Tooltip delayDuration={200}>
                                    <TooltipTrigger asChild>
                                        <span className={`
                                            inline-block mx-1 px-1 rounded cursor-pointer transition-colors border
                                            ${decision === "pending" ? "bg-amber-50 border-amber-200" : ""}
                                            ${decision === "accepted" ? "bg-green-50 border-green-200" : ""}
                                            ${decision === "rejected" ? "bg-red-50 border-red-200" : ""}
                                        `}>
                                            {/* Original Text Representation */}
                                            <span className={`
                                                mr-1 px-0.5 rounded
                                                ${decision === "pending" ? "text-red-500 line-through decoration-red-500/50 bg-red-100/50" : ""}
                                                ${decision === "accepted" ? "text-muted-foreground/50 line-through decoration-muted-foreground/40" : ""}
                                                ${decision === "rejected" ? "text-muted-foreground line-through decoration-muted-foreground/50 bg-muted/50 border-transparent" : ""}
                                            `}>
                                                {originalDisplay}
                                            </span>

                                            {/* Proposed Text Representation */}
                                            <span className={`
                                                px-0.5 rounded
                                                ${decision === "pending" ? "text-green-600 font-medium bg-green-100/50" : ""}
                                                ${decision === "accepted" ? "text-green-700 font-bold bg-green-100" : ""}
                                                ${decision === "rejected" ? "text-muted-foreground/70 line-through decoration-muted-foreground/50" : ""}
                                            `}>
                                                {p.proposedText}
                                            </span>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-md p-4">
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                    Policy Violation
                                                </h4>
                                                <p className="text-sm text-muted-foreground">{p.rationale}</p>
                                            </div>
                                            <div className="flex gap-2 pt-2 border-t">
                                                <Button 
                                                    size="sm" 
                                                    variant={decision === "accepted" ? "default" : "outline"}
                                                    className={decision === "accepted" ? "bg-green-600 hover:bg-green-700" : "hover:bg-green-50 hover:text-green-700 hover:border-green-200"}
                                                    onClick={() => makeDecision(p.id, "accepted")}
                                                >
                                                    <Check className="h-3 w-3 mr-1" />
                                                    Accept Change
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant={decision === "rejected" ? "default" : "outline"}
                                                    className={decision === "rejected" ? "bg-red-600 hover:bg-red-700" : "hover:bg-red-50 hover:text-red-700 hover:border-red-200"}
                                                    onClick={() => makeDecision(p.id, "rejected")}
                                                >
                                                    <X className="h-3 w-3 mr-1" />
                                                    Reject
                                                </Button>
                                            </div>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        );
                    }
                    return null;
                })}
            </div>
            {unmatchedProposals.length > 0 && (
                <div className="max-w-3xl mx-auto mt-8 rounded-md border border-amber-200 bg-amber-50/70 p-4 text-sm">
                    <div className="flex items-center gap-2 text-amber-900 font-medium">
                        <AlertTriangle className="h-4 w-4" />
                        Unable to place {unmatchedProposals.length} change{unmatchedProposals.length === 1 ? "" : "s"} inline
                    </div>
                    <p className="mt-1 text-xs text-amber-900/80">
                        The excerpts below did not exactly match the current draft. Review them manually and accept or reject.
                    </p>
                    <div className="mt-4 space-y-4">
                        {unmatchedProposals.map((proposal) => {
                            const decision = decisions[proposal.id];
                            return (
                                <div key={proposal.id} className="rounded-md border border-amber-200 bg-white/80 p-4 shadow-sm">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        Original text
                                    </p>
                                    <p className="whitespace-pre-wrap font-mono text-xs text-foreground/80 mt-1">
                                        {proposal.originalText}
                                    </p>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mt-3">
                                        Proposed text
                                    </p>
                                    <p className="whitespace-pre-wrap font-mono text-xs text-green-700 mt-1">
                                        {proposal.proposedText}
                                    </p>
                                    <p className="mt-2 text-xs text-muted-foreground">{proposal.rationale}</p>
                                    <div className="mt-3 flex gap-2">
                                        <Button 
                                            size="sm" 
                                            variant={decision === "accepted" ? "default" : "outline"}
                                            className={decision === "accepted" ? "bg-green-600 hover:bg-green-700" : "hover:bg-green-50 hover:text-green-700 hover:border-green-200"}
                                            onClick={() => makeDecision(proposal.id, "accepted")}
                                        >
                                            <Check className="h-3 w-3 mr-1" />
                                            Accept Change
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant={decision === "rejected" ? "default" : "outline"}
                                            className={decision === "rejected" ? "bg-red-600 hover:bg-red-700" : "hover:bg-red-50 hover:text-red-700 hover:border-red-200"}
                                            onClick={() => makeDecision(proposal.id, "rejected")}
                                        >
                                            <X className="h-3 w-3 mr-1" />
                                            Reject
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
          </ScrollArea>
        </Card>
      </div>
    );
  }

  return (
    <Card className={cn(
      "w-full",
      isEmbedded ? "" : "max-w-2xl mx-auto"
    )}>
      <CardHeader className="pb-4 border-b">
        <CardTitle>Input Agreement</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-6 flex flex-col gap-6">
        {effectiveAgreementId ? (
             <div className="bg-muted p-4 rounded-md border">
                <p className="text-sm text-muted-foreground">
                    Resuming review for Agreement ID: <span className="font-mono">{effectiveAgreementId}</span>
                </p>
                {/* 
                    If we have an ID but no proposals were loaded, we still need to show the input 
                    so the user can start the analysis (or re-start it).
                    The handleStartReview logic handles using the existing ID if present.
                */}
             </div>
        ) : (
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="type-select">Agreement Type</Label>
                    <Select value={agreementType} onValueChange={setAgreementType}>
                        <SelectTrigger id="type-select">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="MSA">Master Services Agreement (MSA)</SelectItem>
                            <SelectItem value="SOW">Statement of Work (SOW)</SelectItem>
                            <SelectItem value="NDA">Non-Disclosure Agreement (NDA)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="counterparty">Counterparty Name</Label>
                    <Input 
                        id="counterparty"
                        placeholder="e.g. Acme Corp"
                        value={counterparty}
                        onChange={(e) => setCounterparty(e.target.value)}
                    />
                </div>
            </div>
        )}
        
        <div className="space-y-2">
            <Label>Draft Text</Label>
            <Textarea
            placeholder="Paste the full text of the agreement here..."
            className="min-h-[300px] font-mono text-sm resize-none"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
                Paste the text you want to review. This will be saved as Version 1.
            </p>
        </div>
        
        <div className="space-y-2">
            <PolicyOverrideSelector onExclusionsChange={setExcludedPolicyIds} />
        </div>

        <div className="flex justify-end pt-2">
          <Button 
            onClick={handleStartReview} 
            disabled={!draftText.trim() || isReviewing || isStartingReview}
            size="lg"
            className="w-full sm:w-auto"
          >
            {(isReviewing || isStartingReview) ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isStartingReview ? "Creating Draft..." : "Analyzing Policies..."}
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Start Policy Review
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
