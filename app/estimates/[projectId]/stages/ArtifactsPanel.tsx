"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  Download,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { describeArtifactContent } from "@/lib/utils/artifacts";
import { formatEstimateStageLabel } from "@/lib/utils/estimates";
import { appToaster } from "@/lib/ui/toaster";
import { type EstimateStage } from "@/lib/zod/estimates";
import {
  advanceStageAction,
  removeArtifactAction,
} from "../../actions";
import type { SerializableArtifact } from "../project-types";
import { useStageActions } from "../useStageActionBar";

const artifactFormSchema = z.object({
  type: z.string().trim().min(2, "Type is required.").max(60),
  notes: z
    .string()
    .trim()
    .max(20000, "Notes are too long.")
    .optional()
    .transform((value) => (value && value.length ? value : undefined)),
});

const allowedArtifactExtensions = [".txt", ".pdf", ".docx", ".md"];

const formatFileSize = (size?: number | null) => {
  if (typeof size !== "number" || Number.isNaN(size) || size <= 0) {
    return null;
  }
  if (size < 1024) {
    return `${size} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const dateTimeFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

type ArtifactsPanelProps = {
  projectId: string;
  artifacts: SerializableArtifact[];
  canEdit: boolean;
  nextStage?: EstimateStage;
};

export function ArtifactsPanel({
  projectId,
  artifacts,
  canEdit,
  nextStage,
}: ArtifactsPanelProps) {
  const toast = appToaster;
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof artifactFormSchema>>({
    resolver: zodResolver(artifactFormSchema),
    defaultValues: {
      type: "",
      notes: "",
    },
  });

  const fileBackedCount = useMemo(
    () =>
      artifacts.filter(
        (artifact) => Boolean(artifact.storedFile) || Boolean(artifact.content),
      ).length,
    [artifacts],
  );
  const meetsRequirement = fileBackedCount >= 2;
  const isBusy = isUploading || isAdvancing || removingId !== null;

  const handleAdvance = useCallback(async () => {
    if (!nextStage) {
      return;
    }
    setIsAdvancing(true);
    try {
      await advanceStageAction({ projectId, targetStage: nextStage });
      toast.success({
        title: `Advanced to ${formatEstimateStageLabel(nextStage)}.`,
      });
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error({
        title: "Unable to advance",
        description:
          error instanceof Error ? error.message : "Unexpected error.",
      });
    } finally {
      setIsAdvancing(false);
    }
  }, [nextStage, projectId, toast, router]);

  // Cleanup actions on unmount
  useStageActions(() => {
    if (!canEdit || !nextStage) {
      return null;
    }

    return (
      <Button
        type="button"
        onClick={handleAdvance}
        disabled={!meetsRequirement || isBusy}
        className="inline-flex items-center gap-2"
      >
        {isAdvancing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Working...
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            Advance to {formatEstimateStageLabel(nextStage)}
          </>
        )}
      </Button>
    );
  }, [canEdit, nextStage, meetsRequirement, isBusy, isAdvancing, handleAdvance]);

  const onSubmit = async (values: z.infer<typeof artifactFormSchema>) => {
    const fileToUpload = selectedFile;
    if (!fileToUpload) {
      setFileError("Select a .txt, .pdf, .docx, or .md file to upload.");
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("type", values.type);
      if (values.notes) {
        formData.append("notes", values.notes);
      }
      formData.append("file", fileToUpload);
      const response = await fetch(`/api/projects/${projectId}/artifacts`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to upload artifact.");
      }
      toast.success({ title: "Artifact uploaded." });
      reset();
      setSelectedFile(null);
      setFileError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error({
        title: "Upload failed",
        description:
          error instanceof Error ? error.message : "Unexpected error.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async (artifactId: string) => {
    setRemovingId(artifactId);
    try {
      await removeArtifactAction(projectId, artifactId);
      toast.success({ title: "Artifact removed." });
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error({
        title: "Unable to remove artifact",
        description:
          error instanceof Error ? error.message : "Unexpected error.",
      });
    } finally {
      setRemovingId(null);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (
      file &&
      !allowedArtifactExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext),
      )
    ) {
      setSelectedFile(null);
      setFileError(
        `Unsupported file type. Allowed: ${allowedArtifactExtensions.join(", ")}`,
      );
      event.target.value = "";
      return;
    }
    setFileError(null);
    setSelectedFile(file);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border bg-muted/20 p-4 text-sm">
        <p className="font-semibold">Artifact requirement</p>
        <p className="text-muted-foreground">
          {fileBackedCount} / 2 artifacts captured.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {artifacts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No artifacts have been added yet.
          </p>
        )}
        {artifacts.map((artifact) => {
          const { label: contentLabel, helperText: contentHelper } =
            describeArtifactContent(artifact.content);

          return (
            <div
              key={artifact.id}
              className="rounded-lg border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <p className="font-semibold">{artifact.type}</p>
                  {artifact.originalName && (
                    <p className="text-sm text-muted-foreground">
                      {artifact.originalName}
                      {artifact.sizeBytes
                        ? ` • ${formatFileSize(artifact.sizeBytes)}`
                        : ""}
                    </p>
                  )}
                  {artifact.url && (
                    <a
                      href={artifact.url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-sm text-primary"
                    >
                      {artifact.url}
                    </a>
                  )}
                  {artifact.content && (
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {contentLabel && (
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                          {contentLabel}
                        </p>
                      )}
                      {contentHelper && (
                        <p className="text-xs text-muted-foreground">
                          {contentHelper}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{artifact.content}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Added {dateTimeFormat.format(new Date(artifact.createdAt))}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {artifact.storedFile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="inline-flex items-center gap-1"
                      asChild
                    >
                      <a
                        href={`/api/artifacts/${artifact.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        void handleRemove(artifact.id);
                      }}
                      disabled={isBusy || removingId === artifact.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {canEdit && (
        <form
          className="space-y-4 rounded-lg border bg-card p-4 shadow-sm"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Upload artifact file
          </p>
          <div className="space-y-1">
            <label className="text-sm font-medium">Type</label>
            <Input
              placeholder="Client brief, discovery notes..."
              {...register("type")}
              disabled={isBusy}
            />
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">
              File ({allowedArtifactExtensions.join(", ")})
            </label>
            <Input
              type="file"
              accept={allowedArtifactExtensions.join(",")}
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={isBusy}
            />
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                Selected: {selectedFile.name}
                {selectedFile.size
                  ? ` • ${formatFileSize(selectedFile.size)}`
                  : ""}
              </p>
            )}
            {(fileError || !selectedFile) && (
              <p className="text-xs text-muted-foreground">
                Accepted file types: {allowedArtifactExtensions.join(", ")}
              </p>
            )}
            {fileError && (
              <p className="text-sm text-destructive">{fileError}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea rows={4} {...register("notes")} disabled={isBusy} />
            {errors.notes && (
              <p className="text-sm text-destructive">{errors.notes.message}</p>
            )}
          </div>
          <Button
            type="submit"
            className="inline-flex items-center gap-2"
            disabled={isBusy}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload artifact
              </>
            )}
          </Button>
        </form>
      )}

      {canEdit && nextStage && !meetsRequirement && (
        <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
          <p className="font-semibold">Advance to {formatEstimateStageLabel(nextStage)}</p>
          <p className="text-sm text-muted-foreground">
            Add at least two artifacts to unlock the next stage.
          </p>
          <p className="text-sm text-muted-foreground">
            Currently added: {fileBackedCount} / 2 required artifacts.
          </p>
        </div>
      )}
    </div>
  );
}

