"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Field,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  IconButton,
  Input,
  Link as ChakraLink,
  SimpleGrid,
  Stack,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  Textarea,
  Tooltip,
} from "@chakra-ui/react";
import { AddIcon, DeleteIcon } from "@chakra-ui/icons";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
} from "@/lib/zod/estimates";
import {
  estimateStageOrder,
  stageContentInputSchema,
  wbsItemInputSchema,
} from "@/lib/zod/estimates";
import { formatEstimateStageLabel } from "@/lib/utils/estimates";
import { appToaster } from "@/lib/ui/toaster";
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
    <Stack spacing={8}>
      <Card>
        <CardHeader>
          <Flex justify="space-between" align="flex-start" direction={{ base: "column", md: "row" }}>
            <Stack spacing={1}>
              <Heading size="lg">{project.name}</Heading>
              <Text color="gray.600">{project.clientName ?? "Unassigned client"}</Text>
            </Stack>
            <Badge colorScheme="blue" alignSelf="flex-start" mt={{ base: 4, md: 0 }}>
              Current stage: {formatEstimateStageLabel(project.stage)}
            </Badge>
          </Flex>
        </CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
            <Stat>
              <StatLabel>Created</StatLabel>
              <StatNumber fontSize="md">
                {dateTimeFormat.format(new Date(project.createdAt))}
              </StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Last updated</StatLabel>
              <StatNumber fontSize="md">
                {dateTimeFormat.format(new Date(project.updatedAt))}
              </StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Total WBS hours</StatLabel>
              <StatNumber fontSize="md">{totalWbsHours || "—"}</StatNumber>
            </Stat>
          </SimpleGrid>
        </CardBody>
      </Card>

      <StageNavigator
        currentStage={project.stage}
        selectedStage={selectedStage}
        onSelect={setSelectedStage}
      />

      <Card>
        <CardHeader>
          <Stack spacing={2}>
            <Heading size="md">{meta.title}</Heading>
            <Text color="gray.600">{meta.summary}</Text>
            <Alert status="info" variant="left-accent">
              <AlertIcon />
              {meta.entryCriteria}
            </Alert>
          </Stack>
        </CardHeader>
        <CardBody>
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
            <Stack spacing={4}>
              <Text>
                This estimate has been delivered to the client. Use the controls
                below to review prior stages or update supporting artifacts.
              </Text>
              {project.quote && (
                <Box borderWidth="1px" borderRadius="md" p={4}>
                  <Text fontWeight="semibold" mb={2}>
                    Final quote summary
                  </Text>
                  {project.quote.paymentTerms && (
                    <Text color="gray.700">
                      Payment terms: {project.quote.paymentTerms}
                    </Text>
                  )}
                  {project.quote.timeline && (
                    <Text color="gray.700">
                      Timeline: {project.quote.timeline}
                    </Text>
                  )}
                  {typeof project.quote.total === "number" && (
                    <Text color="gray.700">
                      Total: ${project.quote.total.toLocaleString()}
                    </Text>
                  )}
                </Box>
              )}
            </Stack>
          )}
        </CardBody>
      </Card>

      <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={6}>
        <GridItem>
          <StageTimeline transitions={project.stageTransitions} />
        </GridItem>
        <GridItem>
          <Card>
            <CardHeader>
              <Heading size="md">Artifacts overview</Heading>
            </CardHeader>
            <CardBody>
              <Stack spacing={3}>
                <Text color="gray.600">
                  {project.artifacts.length} artifact
                  {project.artifacts.length === 1 ? "" : "s"} captured.
                </Text>
                <Stack spacing={2}>
                  {project.artifacts.slice(0, 3).map((artifact) => (
                    <Box
                      key={artifact.id}
                      borderWidth="1px"
                      borderRadius="md"
                      p={3}
                    >
                      <Text fontWeight="semibold">{artifact.type}</Text>
                      {artifact.content && (
                        <Text color="gray.600" noOfLines={2}>
                          {artifact.content}
                        </Text>
                      )}
                      <Text fontSize="sm" color="gray.500">
                        Added {dateTimeFormat.format(new Date(artifact.createdAt))}
                      </Text>
                    </Box>
                  ))}
                  {project.artifacts.length === 0 && (
                    <Text color="gray.500">No artifacts yet.</Text>
                  )}
                </Stack>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </Stack>
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
    <Card>
      <CardBody>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={3}
          flexWrap="wrap"
        >
          {estimateStageOrder.map((stage, index) => {
            const isCurrent = stage === selectedStage;
            const isComplete = index < currentIdx;
            const colorScheme = isCurrent
              ? "blue"
              : isComplete
                ? "green"
                : "gray";

            return (
              <Button
                key={stage}
                variant={isCurrent ? "solid" : "outline"}
                colorScheme={colorScheme}
                size="sm"
                onClick={() => onSelect(stage)}
              >
                {formatEstimateStageLabel(stage)}
              </Button>
            );
          })}
        </Stack>
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
    <Stack spacing={6}>
      <Stack spacing={3}>
        {artifacts.length === 0 && (
          <Text color="gray.500">No artifacts have been added yet.</Text>
        )}
        {artifacts.map((artifact) => (
          <Box
            key={artifact.id}
            borderWidth="1px"
            borderRadius="md"
            p={4}
            position="relative"
          >
            <Flex justify="space-between" align="flex-start" gap={4}>
              <Stack spacing={1}>
                <Text fontWeight="semibold">{artifact.type}</Text>
                {artifact.url && (
                  <ChakraLink
                    href={artifact.url}
                    color="blue.500"
                    isExternal
                  >
                    {artifact.url}
                  </ChakraLink>
                )}
                {artifact.content && (
                  <Text color="gray.700" whiteSpace="pre-wrap">
                    {artifact.content}
                  </Text>
                )}
                <Text fontSize="sm" color="gray.500">
                  Added {dateTimeFormat.format(new Date(artifact.createdAt))}
                </Text>
              </Stack>
              {canEdit && (
                <IconButton
                  aria-label="Remove artifact"
                  icon={<DeleteIcon />}
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => handleRemove(artifact.id)}
                  isDisabled={isPending}
                />
              )}
            </Flex>
          </Box>
        ))}
      </Stack>

      {canEdit && (
        <Stack
          as="form"
          spacing={4}
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <Heading size="sm">Add artifact</Heading>
          <Field.Root invalid={Boolean(errors.type)}>
            <Field.Label>Type</Field.Label>
            <Input placeholder="Brief, notes, doc link..." {...register("type")} />
            <Field.ErrorText>{errors.type?.message}</Field.ErrorText>
          </Field.Root>
          <Field.Root invalid={Boolean(errors.url)}>
            <Field.Label>URL (optional)</Field.Label>
            <Input placeholder="https://..." {...register("url")} />
            <Field.ErrorText>{errors.url?.message}</Field.ErrorText>
          </Field.Root>
          <Field.Root invalid={Boolean(errors.content)}>
            <Field.Label>Notes (optional)</Field.Label>
            <Textarea rows={4} {...register("content")} />
            <Field.ErrorText>{errors.content?.message}</Field.ErrorText>
          </Field.Root>
          <Button
            type="submit"
            colorScheme="blue"
            alignSelf="flex-start"
            leftIcon={<AddIcon boxSize={3} />}
            isLoading={isPending}
          >
            Add artifact
          </Button>
        </Stack>
      )}
      {!canEdit && (
        <Alert status="warning" variant="subtle">
          <AlertIcon />
          Artifacts can only be modified while the estimate is in the Artifacts
          stage.
        </Alert>
      )}
    </Stack>
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
    <Stack spacing={4}>
      {record?.approved && (
        <Alert status="success" variant="subtle">
          <AlertIcon />
          Approved content
        </Alert>
      )}
      {!canEdit && (
        <Alert status="warning" variant="subtle">
          <AlertIcon />
          This stage is not currently active. Content is read-only.
        </Alert>
      )}
      <Field.Root invalid={Boolean(errors.content)}>
        <Field.Label>Content</Field.Label>
        <Textarea
          rows={10}
          {...register("content")}
          isReadOnly={!canEdit}
          placeholder="Capture the narrative for this stage..."
        />
        <Field.ErrorText>{errors.content?.message}</Field.ErrorText>
      </Field.Root>
      {canEdit && (
        <HStack spacing={3}>
          <Button
            colorScheme="gray"
            onClick={handleSubmit((values) => onSave(values, false))}
            isLoading={isPending}
            isDisabled={!isDirty && !record?.content}
          >
            Save draft
          </Button>
          <Tooltip
            label={
              nextStage
                ? `Approve this stage and move to ${formatEstimateStageLabel(nextStage)}.`
                : "This is the final stage."
            }
          >
            <Button
              colorScheme="blue"
              onClick={handleSubmit((values) => onSave(values, true))}
              isLoading={isPending}
              isDisabled={!nextStage}
            >
              Approve & advance
            </Button>
          </Tooltip>
        </HStack>
      )}
    </Stack>
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
    <Stack spacing={4}>
      <Box overflowX="auto">
        <Stack
          as="form"
          spacing={4}
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <Stack spacing={3}>
            {fields.map((field, index) => (
              <Grid
                key={field.id}
                templateColumns={{ base: "1fr", md: "2fr 1fr 1fr auto" }}
                gap={3}
                alignItems="center"
                borderWidth="1px"
                borderRadius="md"
                p={3}
              >
                <Field.Root invalid={Boolean(errors.items?.[index]?.task)}>
                  <Field.Label>Task</Field.Label>
                  <Input
                    {...register(`items.${index}.task` as const)}
                    placeholder="Describe the work"
                    isDisabled={!canEdit}
                  />
                  <Field.ErrorText>
                    {errors.items?.[index]?.task?.message}
                  </Field.ErrorText>
                </Field.Root>
                <Field.Root invalid={Boolean(errors.items?.[index]?.role)}>
                  <Field.Label>Role</Field.Label>
                  <Input
                    {...register(`items.${index}.role` as const)}
                    placeholder="Role"
                    isDisabled={!canEdit}
                  />
                  <Field.ErrorText>
                    {errors.items?.[index]?.role?.message}
                  </Field.ErrorText>
                </Field.Root>
                <Field.Root invalid={Boolean(errors.items?.[index]?.hours)}>
                  <Field.Label>Hours</Field.Label>
                  <Input
                    type="number"
                    step="0.5"
                    {...register(`items.${index}.hours` as const, {
                      valueAsNumber: true,
                    })}
                    isDisabled={!canEdit}
                  />
                  <Field.ErrorText>
                    {errors.items?.[index]?.hours?.message}
                  </Field.ErrorText>
                </Field.Root>
                {canEdit && (
                  <IconButton
                    aria-label="Remove row"
                    icon={<DeleteIcon />}
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    onClick={() => remove(index)}
                  />
                )}
              </Grid>
            ))}
          </Stack>
          {canEdit && (
            <Button
              variant="ghost"
              leftIcon={<AddIcon boxSize={3} />}
              onClick={() =>
                append({ task: "", role: "", hours: 0, id: undefined })
              }
            >
              Add row
            </Button>
          )}
          <HStack justify="space-between">
            <Text fontWeight="semibold">Total hours: {totalHours || 0}</Text>
            {canEdit && (
              <Button
                type="submit"
                colorScheme="blue"
                isLoading={isPending}
                isDisabled={!canEdit}
              >
                Save WBS
              </Button>
            )}
          </HStack>
        </Stack>
      </Box>
      {!canEdit && (
        <Alert status="info" variant="subtle">
          <AlertIcon />
          WBS edits are locked until the Effort stage is active.
        </Alert>
      )}
    </Stack>
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
    <Stack spacing={4}>
      {!canEdit && (
        <Alert status="warning" variant="subtle">
          <AlertIcon />
          Quote details are read-only until the quote stage is active.
        </Alert>
      )}
      <Field.Root invalid={Boolean(errors.paymentTerms)}>
        <Field.Label>Payment terms</Field.Label>
        <Textarea
          rows={4}
          {...register("paymentTerms")}
          isReadOnly={!canEdit}
        />
        <Field.ErrorText>{errors.paymentTerms?.message}</Field.ErrorText>
      </Field.Root>
      <Field.Root invalid={Boolean(errors.timeline)}>
        <Field.Label>Timeline</Field.Label>
        <Textarea rows={4} {...register("timeline")} isReadOnly={!canEdit} />
        <Field.ErrorText>{errors.timeline?.message}</Field.ErrorText>
      </Field.Root>
      <Field.Root invalid={Boolean(errors.total)}>
        <Field.Label>Total (USD)</Field.Label>
        <Input
          type="number"
          step="500"
          {...register("total", { valueAsNumber: true })}
          isReadOnly={!canEdit}
        />
        <Field.ErrorText>{errors.total?.message}</Field.ErrorText>
      </Field.Root>
      <Field.Root display="flex" alignItems="center">
        <Checkbox {...register("delivered")} isDisabled={!canEdit}>
          Quote delivered to client
        </Checkbox>
      </Field.Root>
      {canEdit && (
        <HStack spacing={3}>
          <Button
            colorScheme="gray"
            onClick={handleSubmit((values) => persistQuote(values))}
            isLoading={isPending}
          >
            Save details
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleSubmit((values) =>
              persistQuote({ ...values, delivered: true }, true),
            )}
            isLoading={isPending}
            isDisabled={!nextStage}
          >
            Mark delivered & advance
          </Button>
        </HStack>
      )}
    </Stack>
  );
}

function StageTimeline({
  transitions,
}: {
  transitions: SerializableStageTransition[];
}) {
  return (
    <Card>
      <CardHeader>
        <Heading size="md">Stage timeline</Heading>
      </CardHeader>
      <CardBody>
        <Stack spacing={4}>
          {transitions.length === 0 && (
            <Text color="gray.500">
              This project has not advanced to the next stage yet.
            </Text>
          )}
          {transitions.map((transition) => (
            <Box key={transition.id} borderLeftWidth="2px" pl={4} py={2}>
              <Text fontWeight="semibold">
                {formatEstimateStageLabel(transition.from)} →{" "}
                {formatEstimateStageLabel(transition.to)}
              </Text>
              <Text fontSize="sm" color="gray.500">
                {dateTimeFormat.format(new Date(transition.timestamp))}
              </Text>
            </Box>
          ))}
        </Stack>
      </CardBody>
    </Card>
  );
}


