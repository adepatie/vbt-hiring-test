"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatEstimateStageLabel } from "@/lib/utils/estimates";
import { estimateStageOrder, type EstimateStage } from "@/lib/zod/estimates";
import type { ProjectDetailClient, RoleOption } from "./project-types";
import { stageBadgeClass } from "./stage-config";
import { StageContentPanel } from "./StageContentPanel";
import { StageNavigator, StageSidebar } from "./StageNavigation";
import { StageSummaryCard } from "./StageSummary";
import { StageTimeline } from "./StageTimeline";

const dateTimeFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

function ProjectFlowContent({
  project,
  roleOptions,
}: {
  project: ProjectDetailClient;
  roleOptions: RoleOption[];
}) {
  const [selectedStage, setSelectedStage] = useState<EstimateStage>(
    () => project.stage,
  );
  useEffect(() => {
    setSelectedStage(project.stage);
  }, [project.stage]);
  
  const totalWbsHours = useMemo(
    () => project.wbsItems.reduce((sum, item) => sum + item.hours, 0),
    [project.wbsItems],
  );

  const currentStageIndex = Math.max(
    0,
    estimateStageOrder.indexOf(project.stage),
  );
  const isCurrentStage = selectedStage === project.stage;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden w-full">
      {/* Header */}
      <header className="flex-shrink-0 border-b p-4 bg-background flex items-center justify-between">
        <div className="flex items-center gap-6">
            <div className="space-y-1">
                <h1 className="text-lg font-semibold">{project.name}</h1>
                <p className="text-sm text-muted-foreground">
                    {project.clientName ?? "Unassigned client"}
                </p>
            </div>
            
            {/* Project Stats (Moved to Header) */}
            <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground border-l pl-6">
                <div>
                    <span className="font-medium text-foreground">Step {currentStageIndex + 1}</span>
                    <span className="opacity-70">/{estimateStageOrder.length}</span>
                </div>
                <div>
                    <span className="opacity-70">Updated </span>
                    <span className="font-medium text-foreground">{dateTimeFormat.format(new Date(project.updatedAt))}</span>
                </div>
                <div>
                    <span className="opacity-70">WBS </span>
                    <span className="font-medium text-foreground">{totalWbsHours || "—"}h</span>
                </div>
            </div>
        </div>

        <Badge
            className={cn(
                "px-4 py-1 text-sm font-medium",
                stageBadgeClass[project.stage],
            )}
        >
            {formatEstimateStageLabel(project.stage)}
        </Badge>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Secondary Sidebar (Stages + Timeline) */}
        <aside className="hidden h-full min-h-0 w-64 flex-col border-r bg-muted/10 md:flex">
          <div className="max-h-[320px] overflow-y-auto border-b border-border/50 p-4">
            <StageSidebar
              currentStage={project.stage}
              selectedStage={selectedStage}
              onSelect={setSelectedStage}
              restrictFuture
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto bg-background/70 p-4">
            <StageTimeline transitions={project.stageTransitions} />
          </div>
        </aside>

        {/* Main Content */}
        <div className="relative flex min-h-0 flex-1 flex-col min-w-0">
          <div className="flex-1 min-h-0 overflow-y-auto pb-32">
            <div className="flex flex-col min-h-full">
              {/* Mobile Stage Navigator */}
              <div className="p-4 md:hidden">
                <StageNavigator
                  currentStage={project.stage}
                  selectedStage={selectedStage}
                  onSelect={setSelectedStage}
                  restrictFuture
                />
              </div>
              {/* Mobile Timeline */}
              <div className="border-t border-border/50 bg-muted/10 px-4 py-4 md:hidden">
                <StageTimeline transitions={project.stageTransitions} />
              </div>

              <div className="p-4">
                <StageSummaryCard project={project} selectedStage={selectedStage} />
              </div>

              <div className="flex flex-1 min-h-0">
                <StageContentPanel
                  project={project}
                  selectedStage={selectedStage}
                  canEdit={isCurrentStage}
                  roleOptions={roleOptions}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectFlowView(props: {
  project: ProjectDetailClient;
  roleOptions: RoleOption[];
}) {
  return (
      <ProjectFlowContent {...props} />
  );
}
