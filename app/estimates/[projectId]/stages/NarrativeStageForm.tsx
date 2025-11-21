"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatEstimateStageLabel } from "@/lib/utils/estimates";
import { appToaster } from "@/lib/ui/toaster";
import {
  type EstimateStage,
  stageContentInputSchema,
} from "@/lib/zod/estimates";
import {
  advanceStageAction,
  saveStageContentAction,
} from "../../actions";
import type { NarrativeRecord } from "../stage-config";
import { useStageActions } from "../useStageActionBar";
import { callCopilot } from "../copilotHelpers";

const narrativeFormSchema = z.object({
  content: stageContentInputSchema.shape.content,
});

type NarrativeStageFormProps = {
  projectId: string;
  stage: EstimateStage;
  record: NarrativeRecord;
  canEdit: boolean;
  nextStage?: EstimateStage;
};

export function NarrativeStageForm({
  projectId,
  stage,
  record,
  canEdit,
  nextStage,
}: NarrativeStageFormProps) {
  const toast = appToaster;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const stageLabel = formatEstimateStageLabel(stage);
  const isApproved = record?.approved ?? false;
  const isEditable = canEdit && !isApproved;

  const regenerateConfig = useMemo(() => {
    if (stage === "BUSINESS_CASE") {
      return {
        action: "generateBusinessCaseFromArtifacts" as const,
        successDescription:
          "Copilot replaced the Business Case content based on current artifacts.",
        errorMessage:
          "Unable to regenerate the Business Case draft. Try again or adjust your artifacts.",
      };
    }
    if (stage === "REQUIREMENTS") {
      return {
        action: "generateRequirementsFromBusinessCase" as const,
        successDescription:
          "Copilot refreshed the Requirements content using the latest Business Case.",
        errorMessage:
          "Unable to regenerate the Requirements draft. Ensure the Business Case exists and try again.",
      };
    }
    if (stage === "SOLUTION") {
      return {
        action: "generateSolutionArchitectureFromRequirements" as const,
        successDescription:
          "Copilot regenerated the Solution Architecture using the approved Requirements.",
        errorMessage:
          "Unable to regenerate the Solution Architecture draft. Ensure Requirements exist and try again.",
      };
    }
    return null;
  }, [stage]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<z.infer<typeof narrativeFormSchema>>({
    resolver: zodResolver(narrativeFormSchema),
    defaultValues: { content: record?.content ?? "" },
  });

  useEffect(() => {
    reset({ content: record?.content ?? "" });
  }, [record, reset]);

  const onSave = useCallback((
    values: z.infer<typeof narrativeFormSchema>,
    approve = false,
  ) => {
    startTransition(async () => {
      try {
        await saveStageContentAction({
          projectId,
          stage,
          content: values.content,
          approved: approve,
        });
        toast.success({
          title: approve ? "Stage approved." : "Draft saved.",
        });

        if (approve && nextStage) {
          await advanceStageAction({ projectId, targetStage: nextStage });
          toast.success({
            title: `Advanced to ${formatEstimateStageLabel(nextStage)}.`,
          });
        }

        router.refresh();
      } catch (error) {
        console.error(error);
        toast.error({
          title: "Unable to save",
          description:
            error instanceof Error ? error.message : "Unexpected error.",
        });
      }
    });
  }, [nextStage, projectId, router, stage, toast]);

  const handleRegenerate = useCallback(async () => {
    if (!regenerateConfig) return;
    setIsRegenerating(true);
    try {
      await callCopilot(regenerateConfig.action, projectId, { projectId });

      toast.success({
        title: `${stageLabel} regenerated.`,
        description: regenerateConfig.successDescription,
      });

      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error({
        title: "Copilot error",
        description:
          error instanceof Error ? error.message : regenerateConfig.errorMessage,
      });
    } finally {
      setIsRegenerating(false);
    }
  }, [projectId, regenerateConfig, router, stageLabel, toast]);

  // Cleanup actions on unmount
  useStageActions(() => {
    if (!isEditable) {
      return null;
    }

    return (
      <>
        <Button
          variant="outline"
          onClick={handleSubmit((values) => onSave(values, false))}
          disabled={isPending || isRegenerating || (!isDirty && !record?.content)}
        >
          {isPending ? "Saving..." : "Save draft"}
        </Button>
        <Button
          onClick={handleSubmit((values) => onSave(values, true))}
          disabled={isPending || isRegenerating || !nextStage}
          title={
            nextStage
              ? `Approve this stage and move to ${formatEstimateStageLabel(nextStage)}.`
              : "This is the final stage."
          }
        >
          {isPending ? "Working..." : "Approve & advance"}
        </Button>
        {regenerateConfig && (
          <Button
            type="button"
            variant="outline"
            onClick={handleRegenerate}
            disabled={isPending || isRegenerating}
            className="inline-flex items-center gap-2"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Regenerating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Regenerate {stageLabel} with Copilot
              </>
            )}
          </Button>
        )}
      </>
    );
  }, [isEditable, isPending, isRegenerating, isDirty, record, nextStage, regenerateConfig, handleSubmit, onSave, handleRegenerate, stageLabel]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {record?.approved && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Approved content</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-1 min-h-0 flex-col gap-2">
        <div
          className={cn(
            "flex flex-1 min-h-0 flex-col gap-3 rounded-2xl bg-muted/10 px-5 py-4",
            !isEditable && "bg-muted/30",
          )}
        >
          <label className="text-sm font-medium text-muted-foreground">
            Content
          </label>
          <Textarea
            {...register("content")}
            readOnly={!isEditable}
            placeholder="Capture the narrative for this stage..."
            className={cn(
              "h-full min-h-0 flex-1 resize-none overflow-y-auto border-none bg-transparent p-0 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none",
              !isEditable && "text-muted-foreground",
            )}
          />
        </div>
        {errors.content && (
          <p className="text-sm text-destructive">{errors.content.message}</p>
        )}
      </div>
    </div>
  );
}

