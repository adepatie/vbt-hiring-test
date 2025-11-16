import { z } from "zod";

export const estimateStageEnum = z.enum([
  "ARTIFACTS",
  "BUSINESS_CASE",
  "REQUIREMENTS",
  "SOLUTION",
  "EFFORT",
  "QUOTE",
  "DELIVERED",
]);

export type EstimateStage = z.infer<typeof estimateStageEnum>;

export const estimateStageOrder: EstimateStage[] = [
  "ARTIFACTS",
  "BUSINESS_CASE",
  "REQUIREMENTS",
  "SOLUTION",
  "EFFORT",
  "QUOTE",
  "DELIVERED",
];

const cuidString = z.string().cuid();
const nonEmptyText = z.string().trim().min(1, "This field is required.");
const longFormText = z
  .string()
  .trim()
  .min(1, "Content is required.")
  .max(20000, "Content is too long.");

export const projectSchema = z.object({
  id: cuidString,
  name: nonEmptyText.min(3, "Project name is too short.").max(160),
  clientName: z.string().trim().min(1).max(160).optional().nullable(),
  stage: estimateStageEnum,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const projectStubSchema = projectSchema.pick({
  id: true,
  name: true,
  clientName: true,
  stage: true,
  updatedAt: true,
});

export type Project = z.infer<typeof projectSchema>;
export type ProjectStub = z.infer<typeof projectStubSchema>;

export const createProjectInputSchema = z.object({
  name: projectSchema.shape.name,
  clientName: projectSchema.shape.clientName,
});

export const updateProjectMetadataInputSchema = z.object({
  projectId: cuidString,
  name: projectSchema.shape.name.optional(),
  clientName: projectSchema.shape.clientName,
});

const stageContentBaseSchema = z.object({
  id: cuidString,
  projectId: cuidString,
  content: longFormText,
  approved: z.boolean(),
});

export const businessCaseSchema = stageContentBaseSchema;
export const requirementsSchema = stageContentBaseSchema;
export const solutionArchitectureSchema = stageContentBaseSchema;

export type BusinessCase = z.infer<typeof businessCaseSchema>;
export type Requirements = z.infer<typeof requirementsSchema>;
export type SolutionArchitecture = z.infer<typeof solutionArchitectureSchema>;

export const stageContentInputSchema = z.object({
  projectId: cuidString,
  stage: estimateStageEnum,
  content: longFormText,
  approved: z.boolean().optional(),
});

export const artifactSchema = z.object({
  id: cuidString,
  projectId: cuidString,
  type: nonEmptyText.max(120),
  content: z.string().trim().max(20000).nullable(),
  url: z.string().url().nullable(),
  createdAt: z.date(),
});

export const artifactInputSchema = z.object({
  projectId: cuidString,
  type: artifactSchema.shape.type,
  content: artifactSchema.shape.content,
  url: artifactSchema.shape.url,
});

export type Artifact = z.infer<typeof artifactSchema>;

export const wbsItemSchema = z.object({
  id: cuidString,
  projectId: cuidString,
  task: nonEmptyText.max(240),
  role: nonEmptyText.max(120),
  hours: z
    .number({
      invalid_type_error: "Hours must be a number.",
    })
    .positive("Hours must be greater than zero.")
    .max(10000, "Hours is unrealistically large."),
});

export const wbsItemInputSchema = wbsItemSchema
  .omit({ id: true, projectId: true })
  .extend({
    id: cuidString.optional(),
  });

export type WbsItem = z.infer<typeof wbsItemSchema>;
export type WbsItemInput = z.infer<typeof wbsItemInputSchema>;

export const quoteSchema = z.object({
  id: cuidString,
  projectId: cuidString,
  rates: z.record(z.number().nonnegative()).nullable(),
  paymentTerms: z.string().trim().max(2000).nullable(),
  timeline: z.string().trim().max(2000).nullable(),
  total: z.number().nonnegative().nullable(),
  delivered: z.boolean(),
});

export const quoteInputSchema = z.object({
  projectId: cuidString,
  rates: quoteSchema.shape.rates.optional(),
  paymentTerms: quoteSchema.shape.paymentTerms.optional(),
  timeline: quoteSchema.shape.timeline.optional(),
  total: quoteSchema.shape.total.optional(),
  delivered: quoteSchema.shape.delivered.optional(),
});

export type Quote = z.infer<typeof quoteSchema>;

export const stageTransitionSchema = z.object({
  id: cuidString,
  projectId: cuidString,
  from: estimateStageEnum,
  to: estimateStageEnum,
  timestamp: z.date(),
});

export type StageTransition = z.infer<typeof stageTransitionSchema>;

export const projectDetailSchema = projectSchema.extend({
  artifacts: z.array(artifactSchema),
  businessCase: businessCaseSchema.nullable(),
  requirements: requirementsSchema.nullable(),
  solution: solutionArchitectureSchema.nullable(),
  quote: quoteSchema.nullable(),
  wbsItems: z.array(wbsItemSchema),
  stageTransitions: z.array(stageTransitionSchema),
});

export type ProjectDetail = z.infer<typeof projectDetailSchema>;

