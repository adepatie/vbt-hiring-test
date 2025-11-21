import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EstimateStage } from "@/lib/zod/estimates";
import type { ProjectDetailClient } from "./project-types";
import { stageMeta } from "./stage-config";
import { useStageActions } from "./useStageActionBar";

export function StageSummaryCard({
  selectedStage,
}: {
  project: ProjectDetailClient;
  selectedStage: EstimateStage;
}) {
  const meta = stageMeta[selectedStage];

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">{meta.title}</CardTitle>
        <CardDescription>{meta.summary}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export function SummaryPanel({
  project,
}: {
  project: ProjectDetailClient;
}) {
  useStageActions(() => null, []);

  return (
    <div className="space-y-4">
      <p>
        This estimate has been delivered to the client. Use the controls
        below to review prior stages or update supporting artifacts.
      </p>
      {project.quote && (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="mb-2 font-semibold">Final quote summary</p>
          {project.quote.paymentTerms && (
            <p className="text-sm text-muted-foreground">
              Payment terms: {project.quote.paymentTerms}
            </p>
          )}
          {project.quote.timeline && (
            <p className="text-sm text-muted-foreground">
              Timeline: {project.quote.timeline}
            </p>
          )}
          {typeof project.quote.total === "number" && (
            <p className="text-sm text-muted-foreground">
              Total: ${project.quote.total.toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
