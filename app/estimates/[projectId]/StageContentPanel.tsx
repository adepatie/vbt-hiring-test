import { estimateStageOrder, type EstimateStage } from "@/lib/zod/estimates";
import type { ProjectDetailClient, RoleOption } from "./project-types";
import { stageMeta, type NarrativeRecord } from "./stage-config";
import { ArtifactsPanel } from "./stages/ArtifactsPanel";
import { NarrativeStageForm } from "./stages/NarrativeStageForm";
import { QuoteForm } from "./stages/QuoteForm";
import { WbsEditor } from "./stages/WbsEditor";

export function StageContentPanel({
  project,
  selectedStage,
  canEdit,
  roleOptions,
}: {
  project: ProjectDetailClient;
  selectedStage: EstimateStage;
  canEdit: boolean;
  roleOptions: RoleOption[];
}) {
  const meta = stageMeta[selectedStage];
  const selectedStageIndex = estimateStageOrder.indexOf(selectedStage);
  const nextStage = estimateStageOrder[selectedStageIndex + 1];
  const narrativeRecord: NarrativeRecord =
    selectedStage === "BUSINESS_CASE"
      ? project.businessCase
      : selectedStage === "REQUIREMENTS"
        ? project.requirements
        : selectedStage === "SOLUTION"
          ? project.solution
          : null;

  return (
    <div className="flex flex-1 min-h-0 flex-col px-4">
      {meta.type === "artifacts" && (
        <ArtifactsPanel
          projectId={project.id}
          artifacts={project.artifacts}
          canEdit={canEdit}
          nextStage={nextStage}
        />
      )}
      {meta.type === "narrative" && (
        <div className="flex flex-1 min-h-0 flex-col">
          <NarrativeStageForm
            projectId={project.id}
            stage={selectedStage}
            record={narrativeRecord}
            canEdit={canEdit}
            nextStage={nextStage}
          />
        </div>
      )}
      {meta.type === "wbs" && (
        <WbsEditor
          projectId={project.id}
          items={project.wbsItems}
          canEdit={canEdit}
          roles={roleOptions}
        />
      )}
      {meta.type === "quote" && (
        <QuoteForm
          projectId={project.id}
          projectName={project.name}
          clientName={project.clientName}
          quote={project.quote}
          wbsItems={project.wbsItems}
          canEdit={canEdit}
          nextStage={nextStage}
        />
      )}
    </div>
  );
}

