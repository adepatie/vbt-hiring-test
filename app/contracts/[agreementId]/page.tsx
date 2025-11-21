import { contractsService } from "@/lib/services/contractsService";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import ValidationStatus from "./validation-status";
import { AgreementContentWrapper } from "./agreement-content-wrapper";
import { LinkEstimateDialog } from "./link-estimate-dialog";
import { MarkdownRenderer } from "./markdown-renderer";
import ReviewInterface from "../review/review-interface";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ agreementId: string }>;
  searchParams?: Promise<{ view?: string; mode?: string }>;
}

type ContractSearchParams = { view?: string; mode?: string };

export default async function AgreementDetailPage({ params, searchParams }: PageProps) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<ContractSearchParams>({}),
  ]);
  const { agreementId } = resolvedParams;
  const agreement = await contractsService.getAgreement(agreementId);

  if (!agreement) {
    notFound();
  }

  const reviewData = (agreement.reviewData as { proposals?: unknown[] } | null) ?? null;
  const proposals = Array.isArray(reviewData?.proposals) ? reviewData?.proposals : [];
  const hasPendingReview = agreement.status === "REVIEW" || proposals.length > 0;
  const viewParam = resolvedSearchParams?.view ?? resolvedSearchParams?.mode;
  const requestedView =
    viewParam === "review" || viewParam === "document" ? (viewParam as "review" | "document") : undefined;
  const defaultView = hasPendingReview ? "review" : "document";
  const currentView = requestedView ?? defaultView;
  const showReview = hasPendingReview && currentView === "review";
  const currentVersion = agreement.versions[0];

  const buildViewHref = (view: "document" | "review") => {
    const params = new URLSearchParams();
    if (view !== defaultView) {
      params.set("view", view);
    }
    const query = params.toString();
    return query ? `/contracts/${agreementId}?${query}` : `/contracts/${agreementId}`;
  };

  return (
    <div className="flex flex-col h-full p-6 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {agreement.type} - {agreement.counterparty}
              </h1>
              <StatusBadge status={agreement.status} />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>v{currentVersion?.versionNumber ?? 0}</span>
              <span>•</span>
              <span>Updated {formatDistanceToNow(agreement.updatedAt)} ago</span>
              {agreement.project ? (
                <>
                  <span>•</span>
                  <Link 
                    href={`/estimates/${agreement.projectId}`}
                    className="hover:underline text-primary"
                  >
                    Linked to {agreement.project.name}
                  </Link>
                </>
              ) : (
                agreement.type === "SOW" && (
                    <>
                    <span>•</span>
                    <div className="inline-flex">
                      <LinkEstimateDialog agreementId={agreement.id} />
                    </div>
                    </>
                )
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {hasPendingReview && (
            <div className="hidden sm:flex rounded-md border border-border text-sm font-medium overflow-hidden">
              {(["document", "review"] as const).map((view) => (
                <Link
                  key={view}
                  href={buildViewHref(view)}
                  className={cn(
                    "px-3 py-1 transition-colors",
                    currentView === view
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  prefetch={false}
                >
                  {view === "document" ? "Document" : "Review"}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {showReview ? (
        <div className="flex-1 min-h-0">
          <ReviewInterface agreementId={agreement.id} variant="embedded" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
          {/* Main Content - Contract Text */}
          <Card className="lg:col-span-3 flex flex-col overflow-hidden">
            <CardHeader className="pb-4 border-b shrink-0 space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Agreement Text</CardTitle>
              </div>
              {agreement.projectId && (
                <ValidationStatus agreementId={agreement.id} />
              )}
            </CardHeader>
            <ScrollArea className="flex-1 p-6">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <AgreementContentWrapper agreementId={agreement.id}>
                  {currentVersion?.content ? (
                    <MarkdownRenderer content={currentVersion.content} />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                      <FileTextPlaceholder />
                      <p className="mt-4">This agreement is empty.</p>
                      <p className="text-sm">Ask Copilot to "Draft the MSA based on our policies".</p>
                    </div>
                  )}
                </AgreementContentWrapper>
              </div>
            </ScrollArea>
          </Card>

          {/* Sidebar - Version History */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="pb-4 border-b shrink-0">
              <CardTitle className="text-lg">Version History</CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1">
              <div className="divide-y">
                {agreement.versions.map((version) => (
                  <div 
                    key={version.id} 
                    className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                      version.id === currentVersion?.id ? "bg-muted/30" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">Version {version.versionNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(version.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {version.changeNote || "No notes"}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "APPROVED":
      return (
        <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20">
          <CheckCircle className="mr-1 h-3 w-3" />
          Approved
        </Badge>
      );
    case "REVIEW":
      return (
        <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-500/20">
          <AlertCircle className="mr-1 h-3 w-3" />
          In Review
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          {status}
        </Badge>
      );
  }
}

function FileTextPlaceholder() {
  return (
    <svg
      className="h-16 w-16 opacity-20"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
