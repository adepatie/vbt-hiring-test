import { z } from "zod";

export const estimateStageEnum = z.enum([
  "ARTIFACTS",
  "BUSINESS_CASE",
  "REQUIREMENTS",
  "SOLUTION",
  "EFFORT",
  "QUOTE",
]);

export type EstimateStage = z.infer<typeof estimateStageEnum>;

export const estimateStageOrder: EstimateStage[] = [
  "ARTIFACTS",
  "BUSINESS_CASE",
  "REQUIREMENTS",
  "SOLUTION",
  "EFFORT",
  "QUOTE",
];

const cuidString = z.string().cuid();
const roleIdSchema = z
  .string()
  .trim()
  .min(3, "Role id is required.")
  .max(64, "Role id is too long.");
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
  // NOTE: artifact.content stores an AI-generated summary of the uploaded file,
  // not the full raw document. Summaries are capped to keep prompts token-safe.
  content: z
    .string()
    .trim()
    .max(10000, "Artifact summary is too long.")
    .nullable(),
  url: z.string().url().nullable(),
  originalName: z.string().trim().max(255).nullable(),
  storedFile: z.string().trim().max(600).nullable(),
  mimeType: z.string().trim().max(255).nullable(),
  sizeBytes: z
    .number({
      invalid_type_error: "File size must be a number.",
    })
    .int()
    .nonnegative()
    .nullable(),
  createdAt: z.date(),
});

export const artifactInputSchema = z.object({
  projectId: cuidString,
  type: artifactSchema.shape.type,
  content: artifactSchema.shape.content.optional(),
  url: artifactSchema.shape.url.optional(),
  originalName: artifactSchema.shape.originalName.optional(),
  storedFile: artifactSchema.shape.storedFile.optional(),
  mimeType: artifactSchema.shape.mimeType.optional(),
  sizeBytes: artifactSchema.shape.sizeBytes.optional(),
});

export type Artifact = z.infer<typeof artifactSchema>;

const hourlyCostSchema = z
  .number({
    invalid_type_error: "Rate must be a number.",
  })
  .nonnegative("Rate must be greater than or equal to zero.")
  .max(5000, "Rate is unrealistically large.")
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
    "Rate must be rounded to the nearest cent.",
  );

export const roleSchema = z.object({
  id: roleIdSchema,
  name: nonEmptyText.max(120),
  rate: hourlyCostSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const roleInputSchema = roleSchema.pick({
  name: true,
  rate: true,
});

export const createRoleInputSchema = roleInputSchema;

export const updateRoleInputSchema = z
  .object({
    id: cuidString,
    name: roleSchema.shape.name.optional(),
    rate: roleSchema.shape.rate.optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.rate !== undefined,
    "Provide at least one field to update.",
  );

export type Role = z.infer<typeof roleSchema>;
export type RoleInput = z.infer<typeof roleInputSchema>;

export const wbsItemSchema = z.object({
  id: cuidString,
  projectId: cuidString,
  task: nonEmptyText.max(240),
  roleId: roleIdSchema,
  roleName: nonEmptyText.max(120),
  roleRate: hourlyCostSchema,
  hours: z
    .number({
      invalid_type_error: "Hours must be a number.",
    })
    .positive("Hours must be greater than zero.")
    .max(10000, "Hours is unrealistically large."),
});

export const wbsItemInputSchema = z.object({
  id: cuidString.optional(),
  task: wbsItemSchema.shape.task,
  hours: wbsItemSchema.shape.hours,
  roleId: roleIdSchema,
});

export const updateWbsItemsWithRolesSchema = z.object({
  projectId: cuidString,
  items: z
    .array(
      z
        .object({
          id: cuidString.optional(),
          task: wbsItemSchema.shape.task,
          roleId: roleIdSchema.optional(),
          roleName: roleSchema.shape.name.optional(),
          roleRate: roleSchema.shape.rate.optional(),
          hours: wbsItemSchema.shape.hours,
        })
        .strict()
        .refine(
          (item) => Boolean(item.roleId || item.roleName),
          "Each WBS row must include a roleId or roleName.",
        ),
    )
    .max(60, "Cannot update more than 60 WBS rows at once."),
});

export const removeWbsItemsSchema = z.object({
  projectId: cuidString,
  itemIds: z
    .array(cuidString)
    .min(1, "Provide at least one WBS row id to remove.")
    .max(60, "Cannot remove more than 60 WBS rows at once."),
});

export type WbsItem = z.infer<typeof wbsItemSchema>;
export type WbsItemInput = z.infer<typeof wbsItemInputSchema>;

export const quoteSchema = z.object({
  id: cuidString,
  projectId: cuidString,
  // This stores Role Name -> Total Cost (not rate), despite the legacy name 'rates'
  rates: z.record(z.string(), z.number().nonnegative()).nullable(),
  paymentTerms: z.string().trim().max(20000).nullable(),
  timeline: z.string().trim().max(20000).nullable(),
  total: z.number().nonnegative().nullable(),
  overheadFee: z.number().nonnegative(),
  delivered: z.boolean(),
});

export const quoteInputSchema = z
  .object({
    projectId: cuidString,
    paymentTerms: quoteSchema.shape.paymentTerms.optional(),
    timeline: quoteSchema.shape.timeline.optional(),
    overheadFee: quoteSchema.shape.overheadFee
      .max(250000, "Overhead fee is unrealistically large.")
      .optional(),
    delivered: quoteSchema.shape.delivered.optional(),
  })
  .strict();

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

export const generateBusinessCaseFromArtifactsInputSchema = z.object({
  projectId: cuidString,
  instructions: z
    .string()
    .trim()
    .min(1, "Instructions must not be empty.")
    .max(2000, "Instructions are too long.")
    .optional(),
});

export type GenerateBusinessCaseFromArtifactsInput = z.infer<
  typeof generateBusinessCaseFromArtifactsInputSchema
>;

export const generateRequirementsFromBusinessCaseInputSchema = z.object({
  projectId: cuidString,
  instructions: z
    .string()
    .trim()
    .min(1, "Instructions must not be empty.")
    .max(2000, "Instructions are too long.")
    .optional(),
});

export type GenerateRequirementsFromBusinessCaseInput = z.infer<
  typeof generateRequirementsFromBusinessCaseInputSchema
>;

export const generateEffortFromSolutionInputSchema = z.object({
  projectId: cuidString,
  instructions: z
    .string()
    .trim()
    .min(1, "Instructions must not be empty.")
    .max(2000, "Instructions are too long.")
    .optional(),
});

export type GenerateEffortFromSolutionInput = z.infer<
  typeof generateEffortFromSolutionInputSchema
>;

export const generateSolutionFromRequirementsInputSchema = z.object({
  projectId: cuidString,
  instructions: z
    .string()
    .trim()
    .min(1, "Instructions must not be empty.")
    .max(2000, "Instructions are too long.")
    .optional(),
});

export type GenerateSolutionFromRequirementsInput = z.infer<
  typeof generateSolutionFromRequirementsInputSchema
>;
