"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { describeArtifactContent } from "@/lib/utils/artifacts";
import { formatEstimateStageLabel } from "@/lib/utils/estimates";
import type { EstimateStage } from "@/lib/zod/estimates";
import { appToaster } from "@/lib/ui/toaster";
import { updateProjectMetadataAction } from "../actions";
import type { ProjectDetailClient, RoleOption } from "./project-types";
import { StageContentPanel } from "./StageContentPanel";
import { StageNavigator } from "./StageNavigation";
import { StageSummaryCard } from "./StageSummary";
import { StageTimeline } from "./StageTimeline";
import { stageBadgeClass } from "./stage-config";
import { ProjectMetadataDialog } from "../project-metadata-dialog";

const dateTimeFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function ProjectDetailView({
  project,
  roleOptions,
}: {
  project: ProjectDetailClient;
  roleOptions: RoleOption[];
}) {
  return (
      <ProjectDetailViewContent project={project} roleOptions={roleOptions} />
  );
}

function ProjectDetailViewContent({
  project,
  roleOptions,
}: {
  project: ProjectDetailClient;
  roleOptions: RoleOption[];
}) {
  const router = useRouter();
  const toast = appToaster;
  const [selectedStage, setSelectedStage] = useState<EstimateStage>(
    () => project.stage,
  );
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const stagePanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedStage(project.stage);
  }, [project.stage]);

  const totalWbsHours = useMemo(
    () => project.wbsItems.reduce((sum, item) => sum + item.hours, 0),
    [project.wbsItems],
  );

  const handleUpdateMetadata = async (values: {
    name: string;
    clientName?: string;
  }) => {
    try {
      await updateProjectMetadataAction({
        projectId: project.id,
        name: values.name,
        clientName: values.clientName || null,
      });
      toast.success({
        title: "Project updated",
        description: "Project details have been saved.",
      });
    } catch (error) {
      toast.error({
        title: "Failed to update project",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-2xl">{project.name}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit Project Name</span>
              </Button>
            </div>
            <CardDescription>
              {project.clientName ?? "Unassigned client"}
            </CardDescription>
          </div>
          <Badge
            className={cn(
              "px-4 py-1 text-sm font-medium",
              stageBadgeClass[project.stage],
            )}
          >
            Current stage: {formatEstimateStageLabel(project.stage)}
          </Badge>
        </CardHeader>
        <CardBody>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Created
              </p>
              <p className="text-lg font-semibold">
                {dateTimeFormat.format(new Date(project.createdAt))}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Last updated
              </p>
              <p className="text-lg font-semibold">
                {dateTimeFormat.format(new Date(project.updatedAt))}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Total WBS hours
              </p>
              <p className="text-lg font-semibold">{totalWbsHours || "—"}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <ProjectMetadataDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialData={{
          name: project.name,
          clientName: project.clientName ?? undefined,
        }}
        onSubmit={handleUpdateMetadata}
      />

      <StageNavigator
        currentStage={project.stage}
        selectedStage={selectedStage}
        onSelect={setSelectedStage}
      />

      <StageSummaryCard project={project} selectedStage={selectedStage} />
      {selectedStage === "BUSINESS_CASE" && !project.businessCase?.approved && (
        <Card className="shadow-sm">
          <CardBody className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Generate Business Case with Copilot
              </p>
              <p className="text-xs text-muted-foreground">
                Use artifacts and discovery notes to draft or refresh the Business
                Case narrative. Content remains unapproved until you review it.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="mt-2 inline-flex items-center gap-2 md:mt-0"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const response = await fetch("/api/copilot", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        action: "generateBusinessCaseFromArtifacts",
                        workflow: "estimates",
                        entityId: project.id,
                        view: "stage",
                        payload: {
                          projectId: project.id,
                        },
                      }),
                    });

                    if (!response.ok) {
                      const payload = await response.json().catch(() => null);
                      throw new Error(
                        payload?.error ?? "Unable to generate business case.",
                      );
                    }

                    toast.success({
                      title: "Business Case draft updated.",
                      description:
                        "Copilot used your artifacts to refresh the Business Case content.",
                    });
                    router.refresh();
                  } catch (error) {
                    console.error(error);
                    toast.error({
                      title: "Copilot error",
                      description:
                        error instanceof Error
                          ? error.message
                          : "Unable to generate Business Case draft.",
                    });
                  }
                });
              }}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate draft
                </>
              )}
            </Button>
          </CardBody>
        </Card>
      )}
      <div ref={stagePanelRef}>
        <StageContentPanel
          project={project}
          selectedStage={selectedStage}
          canEdit={false}
          roleOptions={roleOptions}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <StageTimeline transitions={project.stageTransitions} />
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Artifacts overview</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {project.artifacts.length} artifact
              {project.artifacts.length === 1 ? "" : "s"} captured.
            </p>
            <div className="space-y-3">
              {project.artifacts.slice(0, 3).map((artifact) => {
                const { label: contentLabel } = describeArtifactContent(
                  artifact.content,
                );

                return (
                  <div key={artifact.id} className="rounded-lg border p-3">
                    <p className="font-semibold">{artifact.type}</p>
                    {artifact.content && (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {contentLabel && (
                          <p className="text-xs font-medium uppercase tracking-wide text-primary">
                            {contentLabel}
                          </p>
                        )}
                        <p className="line-clamp-2">{artifact.content}</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Added {dateTimeFormat.format(new Date(artifact.createdAt))}
                    </p>
                  </div>
                );
              })}
              {project.artifacts.length === 0 && (
                <p className="text-sm text-muted-foreground">No artifacts yet.</p>
              )}
              {project.artifacts.length > 3 && (
                <div className="flex items-center justify-between rounded-md border border-dashed p-3 text-sm">
                  <div className="space-y-1 text-muted-foreground">
                    <p className="font-medium text-foreground">Need a file download?</p>
                    <p>
                      View the full artifact list to access every summary and download the
                      original uploads.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedStage("ARTIFACTS");
                      stagePanelRef.current?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    View all
                  </Button>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
