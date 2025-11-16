"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardBody,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatEstimateStageLabel } from "@/lib/utils/estimates";
import { appToaster } from "@/lib/ui/toaster";
import {
  type Artifact,
  type BusinessCase,
  type EstimateStage,
  type ProjectDetail,
  type Quote,
  type Requirements,
  type SolutionArchitecture,
  type StageTransition,
  type WbsItem,
  estimateStageOrder,
  stageContentInputSchema,
  wbsItemInputSchema,
} from "@/lib/zod/estimates";
import {
  addArtifactAction,
  advanceStageAction,
  removeArtifactAction,
  saveQuoteAction,
  saveStageContentAction,
  updateWbsItemsAction,
} from "../actions";

const dateTimeFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

const stageMeta: Record<
  EstimateStage,
  {
    title: string;
    summary: string;
    entryCriteria: string;
    type: "artifacts" | "narrative" | "wbs" | "quote" | "summary";
  }
> = {
  ARTIFACTS: {
    title: "Artifacts",
    summary: "Collect existing documents, links, or notes for this project.",
    entryCriteria:
      "Gather at least the primary client brief and any discovery notes.",
    type: "artifacts",
  },
  BUSINESS_CASE: {
    title: "Business Case",
    summary: "Describe the business goals, success metrics, and constraints.",
    entryCriteria:
      "Artifacts uploaded and reviewed. Capture goals, risks, and desired outcomes.",
    type: "narrative",
  },
  REQUIREMENTS: {
    title: "Requirements",
    summary:
      "Translate the business case into prioritized requirements and acceptance criteria.",
    entryCriteria:
      "Business case approved. Requirements should cover scope, users, and constraints.",
    type: "narrative",
  },
  SOLUTION: {
    title: "Solution / Architecture",
    summary:
      "Outline the proposed solution, architecture decisions, and major risks.",
    entryCriteria:
      "Requirements finalized. Provide diagrams/description that address key needs.",
    type: "narrative",
  },
  EFFORT: {
    title: "Effort Estimate (WBS)",
    summary:
      "Break down the work into WBS items with task, role, and estimated hours.",
    entryCriteria:
      "Solution defined. Provide a complete WBS including QA, PM, and support.",
    type: "wbs",
  },
  QUOTE: {
    title: "Quote",
    summary:
      "Translate the WBS into pricing details, payment terms, and delivery timeline.",
    entryCriteria:
      "WBS approved. Provide pricing, payment schedule, and timeline for the client.",
    type: "quote",
  },
  DELIVERED: {
    title: "Delivered",
    summary: "Quote has been delivered to the client.",
    entryCriteria:
      "Quote finalized and sent. Capture any final delivery notes if needed.",
    type: "summary",
  },
};

export type SerializableArtifact = Omit<Artifact, "createdAt"> & {
  createdAt: string;
};

export type SerializableStageTransition = Omit<StageTransition, "timestamp"> & {
  timestamp: string;
};

export type ProjectDetailClient = Omit<
  ProjectDetail,
  "createdAt" | "updatedAt" | "artifacts" | "stageTransitions"
> & {
  createdAt: string;
  updatedAt: string;
  artifacts: SerializableArtifact[];
  stageTransitions: SerializableStageTransition[];
};

type NarrativeRecord =
  | BusinessCase
  | Requirements
  | SolutionArchitecture
  | null;

const narrativeFormSchema = z.object({
  content: stageContentInputSchema.shape.content,
});

const artifactFormSchema = z.object({
  type: z.string().trim().min(2, "Type is required.").max(60),
  url: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length ? value : undefined))
    .refine(
      (value) => !value || /^https?:\/\//.test(value),
      "Enter a valid URL (starting with http or https).",
    ),
  content: z.string().trim().max(20000).optional(),
});

const wbsFormSchema = z.object({
  items: z
    .array(
      wbsItemInputSchema.extend({
        task: z.string().trim().min(1, "Task is required.").max(240),
        role: z.string().trim().min(1, "Role is required.").max(120),
        hours: z
          .number({ invalid_type_error: "Hours must be a number." })
          .positive("Hours must be greater than zero.")
          .max(10000, "Hours is unrealistically large."),
      }),
    )
    .min(1, "Add at least one WBS item."),
});

const quoteTotalSchema = z
  .number({ invalid_type_error: "Total must be a number." })
  .nonnegative("Total must be positive.");

const quoteFormSchema = z.object({
  paymentTerms: z.string().trim().max(2000).optional(),
  timeline: z.string().trim().max(2000).optional(),
  total: z.preprocess(
    (value) =>
      typeof value === "number" && Number.isNaN(value) ? undefined : value,
    quoteTotalSchema.optional(),
  ),
  delivered: z.boolean().optional(),
});

const normalizeWbsItems = (items: WbsItem[]) =>
  (items.length > 0
    ? items
    : [
        {
          id: undefined,
          task: "",
          role: "",
          hours: 0,
        },
      ]
  ).map(({ id, task, role, hours }) => ({
    id,
    task,
    role,
    hours,
  }));

const stageBadgeClass: Record<EstimateStage, string> = {
  ARTIFACTS: "bg-slate-100 text-slate-700",
  BUSINESS_CASE: "bg-purple-100 text-purple-700",
  REQUIREMENTS: "bg-blue-100 text-blue-700",
  SOLUTION: "bg-teal-100 text-teal-700",
  EFFORT: "bg-amber-100 text-amber-800",
  QUOTE: "bg-orange-100 text-orange-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
};

export function ProjectDetailView({ project }: { project: ProjectDetailClient }) {
  const [selectedStage, setSelectedStage] = useState<EstimateStage>(
    () => project.stage,
  );
  const selectedStageIndex = estimateStageOrder.indexOf(selectedStage);
  const nextStage = estimateStageOrder[selectedStageIndex + 1];
  const meta = stageMeta[selectedStage];
  const canEdit = selectedStage === project.stage;

  const narrativeRecord: NarrativeRecord =
    selectedStage === "BUSINESS_CASE"
      ? project.businessCase
      : selectedStage === "REQUIREMENTS"
        ? project.requirements
        : selectedStage === "SOLUTION"
          ? project.solution
          : null;

  const totalWbsHours = useMemo(
    () => project.wbsItems.reduce((sum, item) => sum + item.hours, 0),
    [project.wbsItems],
  );

  return (
    <div className="flex flex-col gap-8">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl">{project.name}</CardTitle>
            <CardDescription>
              {project.clientName ?? "Unassigned client"}
            </CardDescription>
          </div>
          <Badge className={cn("px-4 py-1 text-sm font-medium", stageBadgeClass[project.stage])}>
            Current stage: {formatEstimateStageLabel(project.stage)}
          </Badge>
        </CardHeader>
        <CardBody>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p className="text-lg font-semibold">
                {dateTimeFormat.format(new Date(project.createdAt))}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">Last updated</p>
              <p className="text-lg font-semibold">
                {dateTimeFormat.format(new Date(project.updatedAt))}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm font-medium text-muted-foreground">Total WBS hours</p>
              <p className="text-lg font-semibold">{totalWbsHours || "—"}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <StageNavigator
        currentStage={project.stage}
        selectedStage={selectedStage}
        onSelect={setSelectedStage}
      />

      <Card className="shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl">{meta.title}</CardTitle>
          <CardDescription>{meta.summary}</CardDescription>
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertDescription>{meta.entryCriteria}</AlertDescription>
          </Alert>
        </CardHeader>
        <CardBody className="space-y-4">
          {meta.type === "artifacts" && (
            <ArtifactsPanel
              projectId={project.id}
              artifacts={project.artifacts}
              canEdit={canEdit}
            />
          )}
          {meta.type === "narrative" && (
            <NarrativeStageForm
              projectId={project.id}
              stage={selectedStage}
              record={narrativeRecord}
              canEdit={canEdit}
              nextStage={nextStage}
            />
          )}
          {meta.type === "wbs" && (
            <WbsEditor
              projectId={project.id}
              items={project.wbsItems}
              canEdit={canEdit}
            />
          )}
          {meta.type === "quote" && (
            <QuoteForm
              projectId={project.id}
              quote={project.quote}
              canEdit={canEdit}
              nextStage={nextStage}
            />
          )}
          {meta.type === "summary" && (
            <div className="space-y-4">
              <p>
                This estimate has been delivered to the client. Use the controls below to review prior
                stages or update supporting artifacts.
              </p>
              {project.quote && (
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <p className="font-semibold mb-2">Final quote summary</p>
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
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <StageTimeline transitions={project.stageTransitions} />
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Artifacts overview</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {project.artifacts.length} artifact{project.artifacts.length === 1 ? "" : "s"} captured.
            </p>
            <div className="space-y-2">
              {project.artifacts.slice(0, 3).map((artifact) => (
                <div key={artifact.id} className="rounded-lg border p-3">
                  <p className="font-semibold">{artifact.type}</p>
                  {artifact.content && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{artifact.content}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Added {dateTimeFormat.format(new Date(artifact.createdAt))}
                  </p>
                </div>
              ))}
              {project.artifacts.length === 0 && (
                <p className="text-sm text-muted-foreground">No artifacts yet.</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function StageNavigator({
  currentStage,
  selectedStage,
  onSelect,
}: {
  currentStage: EstimateStage;
  selectedStage: EstimateStage;
  onSelect: (stage: EstimateStage) => void;
}) {
  const currentIdx = estimateStageOrder.indexOf(currentStage);

  return (
    <Card className="shadow-sm">
      <CardBody>
        <div className="flex flex-wrap gap-3">
          {estimateStageOrder.map((stage, index) => {
            const isCurrent = stage === selectedStage;
            const isComplete = index < currentIdx;

            return (
              <Button
                key={stage}
                variant={isCurrent ? "default" : "outline"}
                className={cn(
                  "text-sm",
                  isComplete && !isCurrent
                    ? "border-green-200 text-green-700 hover:bg-green-50"
                    : null,
                )}
                onClick={() => onSelect(stage)}
              >
                {formatEstimateStageLabel(stage)}
              </Button>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

function ArtifactsPanel({
  projectId,
  artifacts,
  canEdit,
}: {
  projectId: string;
  artifacts: SerializableArtifact[];
  canEdit: boolean;
}) {
  const toast = appToaster;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof artifactFormSchema>>({
    resolver: zodResolver(artifactFormSchema),
    defaultValues: {
      type: "",
      url: "",
      content: "",
    },
  });

  const onSubmit = (values: z.infer<typeof artifactFormSchema>) => {
    startTransition(async () => {
      try {
        await addArtifactAction({
          projectId,
          type: values.type,
          content: values.content?.length ? values.content : undefined,
          url: values.url,
        });
        toast.success({ title: "Artifact added." });
        reset();
        router.refresh();
      } catch (error) {
        console.error(error);
        toast.error({
          title: "Unable to add artifact",
          description:
            error instanceof Error ? error.message : "Unexpected error.",
        });
      }
    });
  };

  const handleRemove = (artifactId: string) => {
    startTransition(async () => {
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
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {artifacts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No artifacts have been added yet.
          </p>
        )}
        {artifacts.map((artifact) => (
          <div
            key={artifact.id}
            className="rounded-lg border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <p className="font-semibold">{artifact.type}</p>
                {artifact.url && (
                  <a
                    href={artifact.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary break-all"
                  >
                    {artifact.url}
                  </a>
                )}
                {artifact.content && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {artifact.content}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Added {dateTimeFormat.format(new Date(artifact.createdAt))}
                </p>
              </div>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(artifact.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <form
          className="space-y-4 rounded-lg border bg-card p-4 shadow-sm"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Add artifact
          </p>
          <div className="space-y-1">
            <label className="text-sm font-medium">Type</label>
            <Input
              placeholder="Brief, notes, doc link..."
              {...register("type")}
              disabled={isPending}
            />
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">URL (optional)</label>
            <Input placeholder="https://..." {...register("url")} disabled={isPending} />
            {errors.url && (
              <p className="text-sm text-destructive">{errors.url.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea rows={4} {...register("content")} disabled={isPending} />
            {errors.content && (
              <p className="text-sm text-destructive">{errors.content.message}</p>
            )}
          </div>
          <Button
            type="submit"
            className="inline-flex items-center gap-2"
            disabled={isPending}
          >
            <Plus className="h-4 w-4" />
            Add artifact
          </Button>
        </form>
      )}
      {!canEdit && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Artifacts can only be modified while the estimate is in the Artifacts stage.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function NarrativeStageForm({
  projectId,
  stage,
  record,
  canEdit,
  nextStage,
}: {
  projectId: string;
  stage: EstimateStage;
  record: NarrativeRecord;
  canEdit: boolean;
  nextStage?: EstimateStage;
}) {
  const toast = appToaster;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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

  const onSave = (values: z.infer<typeof narrativeFormSchema>, approve = false) => {
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
  };

  return (
    <div className="flex flex-col gap-4">
      {record?.approved && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Approved content</AlertDescription>
        </Alert>
      )}
      {!canEdit && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This stage is not currently active. Content is read-only.
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-1">
        <label className="text-sm font-medium">Content</label>
        <Textarea
          rows={10}
          {...register("content")}
          readOnly={!canEdit}
          placeholder="Capture the narrative for this stage..."
          className={!canEdit ? "bg-muted/30" : undefined}
        />
        {errors.content && (
          <p className="text-sm text-destructive">{errors.content.message}</p>
        )}
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={handleSubmit((values) => onSave(values, false))}
            disabled={isPending || (!isDirty && !record?.content)}
          >
            {isPending ? "Saving..." : "Save draft"}
          </Button>
          <Button
            onClick={handleSubmit((values) => onSave(values, true))}
            disabled={isPending || !nextStage}
            title={
              nextStage
                ? `Approve this stage and move to ${formatEstimateStageLabel(nextStage)}.`
                : "This is the final stage."
            }
          >
            {isPending ? "Working..." : "Approve & advance"}
          </Button>
        </div>
      )}
    </div>
  );
}

type WbsFormValues = z.infer<typeof wbsFormSchema>;

function WbsEditor({
  projectId,
  items,
  canEdit,
}: {
  projectId: string;
  items: WbsItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = appToaster;
  const [isPending, startTransition] = useTransition();
  const initialItems = normalizeWbsItems(items);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<WbsFormValues>({
    resolver: zodResolver(wbsFormSchema),
    defaultValues: { items: initialItems },
  });

  useEffect(() => {
    reset({ items: normalizeWbsItems(items) });
  }, [items, reset]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = useWatch({ control, name: "items" }) ?? [];
  const totalHours = watchedItems.reduce(
    (sum, item) => sum + (Number(item.hours) || 0),
    0,
  );

  const onSubmit = (values: WbsFormValues) => {
    startTransition(async () => {
      try {
        await updateWbsItemsAction({
          projectId,
          items: values.items.map((item) => ({
            ...item,
            hours: Number(item.hours),
          })),
        });
        toast.success({ title: "WBS updated." });
        router.refresh();
      } catch (error) {
        console.error(error);
        toast.error({
          title: "Unable to update WBS",
          description:
            error instanceof Error ? error.message : "Unexpected error.",
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-[2fr_1fr_1fr_auto]"
            >
              <div className="space-y-1">
                <label className="text-sm font-medium">Task</label>
                <Input
                  {...register(`items.${index}.task` as const)}
                  placeholder="Describe the work"
                  disabled={!canEdit}
                />
                {errors.items?.[index]?.task && (
                  <p className="text-sm text-destructive">
                    {errors.items?.[index]?.task?.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Role</label>
                <Input
                  {...register(`items.${index}.role` as const)}
                  placeholder="Role"
                  disabled={!canEdit}
                />
                {errors.items?.[index]?.role && (
                  <p className="text-sm text-destructive">
                    {errors.items?.[index]?.role?.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Hours</label>
                <Input
                  type="number"
                  step="0.5"
                  {...register(`items.${index}.hours` as const, {
                    valueAsNumber: true,
                  })}
                  disabled={!canEdit}
                />
                {errors.items?.[index]?.hours && (
                  <p className="text-sm text-destructive">
                    {errors.items?.[index]?.hours?.message}
                  </p>
                )}
              </div>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              className="inline-flex items-center gap-2"
              onClick={() => append({ task: "", role: "", hours: 0, id: undefined })}
            >
              <Plus className="h-4 w-4" />
              Add row
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save WBS"}
            </Button>
          </div>
        )}
        <p className="text-sm font-semibold">
          Total hours: <span className="font-normal">{totalHours || 0}</span>
        </p>
      </form>
      {!canEdit && (
        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertDescription>
            WBS edits are locked until the Effort stage is active.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function QuoteForm({
  projectId,
  quote,
  canEdit,
  nextStage,
}: {
  projectId: string;
  quote: Quote | null;
  canEdit: boolean;
  nextStage?: EstimateStage;
}) {
  const toast = appToaster;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<z.infer<typeof quoteFormSchema>>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      paymentTerms: quote?.paymentTerms ?? "",
      timeline: quote?.timeline ?? "",
      total: quote?.total,
      delivered: quote?.delivered ?? false,
    },
  });

  useEffect(() => {
    reset({
      paymentTerms: quote?.paymentTerms ?? "",
      timeline: quote?.timeline ?? "",
      total: quote?.total,
      delivered: quote?.delivered ?? false,
    });
  }, [quote, reset]);

  const persistQuote = (
    values: z.infer<typeof quoteFormSchema>,
    advance = false,
  ) => {
    startTransition(async () => {
      try {
        await saveQuoteAction({
          projectId,
          paymentTerms: values.paymentTerms,
          timeline: values.timeline,
          total:
            typeof values.total === "number" && !Number.isNaN(values.total)
              ? values.total
              : undefined,
          delivered: values.delivered,
        });
        toast.success({ title: "Quote saved." });

        if (advance && nextStage) {
          await advanceStageAction({ projectId, targetStage: nextStage });
          toast.success({
            title: `Advanced to ${formatEstimateStageLabel(nextStage)}.`,
          });
        }

        router.refresh();
      } catch (error) {
        console.error(error);
        toast.error({
          title: "Unable to save quote",
          description:
            error instanceof Error ? error.message : "Unexpected error.",
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {!canEdit && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Quote details are read-only until the quote stage is active.
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-1">
        <label className="text-sm font-medium">Payment terms</label>
        <Textarea
          rows={4}
          {...register("paymentTerms")}
          readOnly={!canEdit}
          className={!canEdit ? "bg-muted/30" : undefined}
        />
        {errors.paymentTerms && (
          <p className="text-sm text-destructive">{errors.paymentTerms.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Timeline</label>
        <Textarea
          rows={4}
          {...register("timeline")}
          readOnly={!canEdit}
          className={!canEdit ? "bg-muted/30" : undefined}
        />
        {errors.timeline && (
          <p className="text-sm text-destructive">{errors.timeline.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Total (USD)</label>
        <Input
          type="number"
          step="500"
          {...register("total", { valueAsNumber: true })}
          readOnly={!canEdit}
        />
        {errors.total && (
          <p className="text-sm text-destructive">{errors.total.message}</p>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border border-input bg-background"
          {...register("delivered")}
          disabled={!canEdit}
        />
        Quote delivered to client
      </label>
      {canEdit && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={handleSubmit((values) => persistQuote(values))}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save details"}
          </Button>
          <Button
            onClick={handleSubmit((values) =>
              persistQuote({ ...values, delivered: true }, true),
            )}
            disabled={isPending || !nextStage}
          >
            {isPending ? "Working..." : "Mark delivered & advance"}
          </Button>
        </div>
      )}
    </div>
  );
}

function StageTimeline({
  transitions,
}: {
  transitions: SerializableStageTransition[];
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Stage timeline</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {transitions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            This project has not advanced to the next stage yet.
          </p>
        )}
        {transitions.map((transition) => (
          <div key={transition.id} className="border-l-2 border-border pl-4">
            <p className="font-semibold">
              {formatEstimateStageLabel(transition.from)} →{" "}
              {formatEstimateStageLabel(transition.to)}
            </p>
            <p className="text-xs text-muted-foreground">
              {dateTimeFormat.format(new Date(transition.timestamp))}
            </p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}


