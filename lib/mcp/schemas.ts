import { z } from "zod";
import {
  generateBusinessCaseFromArtifactsInputSchema,
  generateRequirementsFromBusinessCaseInputSchema,
  generateSolutionFromRequirementsInputSchema,
  generateEffortFromSolutionInputSchema,
  updateWbsItemsWithRolesSchema,
  removeWbsItemsSchema as removeWbsItemsInputSchema,
} from "../zod/estimates";

// Re-exporting existing Zod schemas for Estimates
export const generateBusinessCaseSchema = generateBusinessCaseFromArtifactsInputSchema;
export const generateRequirementsSchema = generateRequirementsFromBusinessCaseInputSchema;
export const generateSolutionSchema = generateSolutionFromRequirementsInputSchema;
export const generateWbsItemsSchema = generateEffortFromSolutionInputSchema;
export const upsertWbsItemsSchema = updateWbsItemsWithRolesSchema;
export const removeWbsItemsSchema = removeWbsItemsInputSchema;

// --- Read Tools Schemas ---

export const getProjectDetailsSchema = z.object({
  projectId: z.string().cuid(),
});

export const searchProjectsSchema = z.object({
  query: z.string().min(1),
});

export const listAgreementsSchema = z.object({
  projectId: z.string().cuid(),
});

export const getAgreementSchema = z.object({
  agreementId: z.string().cuid(),
});

// --- Roles Tools Schemas ---

export const listRolesSchema = z.object({});

export const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required.").max(100),
  rate: z.number().positive("Rate must be positive."),
});

export const updateRoleSchema = z.object({
  roleId: z.string().min(1, "Role ID is required."),
  name: z.string().max(100).optional(),
  rate: z.number().positive().optional(),
});

// --- Quote Tools Schemas ---

export const getPricingDefaultsSchema = z.object({});

export const updatePricingDefaultsSchema = z.object({
  overheadFee: z.number().nonnegative(),
});

export const generateQuoteTermsSchema = z.object({
  projectId: z.string().cuid(),
  subtotal: z.number().nonnegative(),
  overheadFee: z.number().nonnegative(),
  total: z.number().nonnegative(),
  wbsSummary: z.string().min(1),
  instructions: z.string().optional().nullable(),
});

// --- Artifact Tools Schemas ---

export const summarizeArtifactSchema = z.object({
  projectId: z.string().cuid(),
  projectName: z.string().min(1),
  artifactId: z.string().min(1),
  artifactType: z.string().min(1),
  originalName: z.string().optional().nullable(),
  rawText: z.string().min(1),
  mode: z.enum(["storage", "prompt"]),
  maxTokens: z.number().positive().optional(),
});

// --- Contracts Tools Schemas ---

export const createContractSchema = z
  .object({
    type: z.enum(["MSA", "SOW"]),
    counterparty: z.string().min(1).max(200),
    projectId: z.string().cuid().optional(),
    instructions: z.string().max(2000).optional().nullable(),
  })
  .strict();

export const createContractsFromProjectSchema = z
  .object({
    projectId: z.string().cuid(),
    agreementTypes: z
      .array(z.enum(["MSA", "SOW"]))
      .min(1)
      .max(2),
    counterparty: z.string().min(1).max(200).optional(),
    instructions: z.string().max(2000).optional().nullable(),
    excludedPolicyIds: z.array(z.string()).optional(),
    runAutoReview: z.boolean().optional(),
  })
  .strict();

export const generateContractDraftSchema = z
  .object({
    agreementId: z.string().cuid(),
    instructions: z.string().max(2000).optional().nullable(),
    excludedPolicyIds: z.array(z.string()).optional(),
  })
  .strict();

export const reviewContractDraftSchema = z
  .object({
    agreementId: z.string().cuid().optional(),
    agreementType: z.string().max(50).optional(),
    incomingDraft: z.string().min(1).max(200000),
    excludedPolicyIds: z.array(z.string()).optional(),
  })
  .strict();

export const validateContractSchema = z
  .object({
    agreementId: z.string().cuid(),
  })
  .strict();

export const createContractVersionSchema = z
  .object({
    agreementId: z.string().cuid(),
    content: z.string().min(1).max(200000),
    changeNote: z.string().max(2000).optional(),
  })
  .strict();

export const updateContractNotesSchema = z
  .object({
    agreementId: z.string().cuid(),
    notes: z.string().min(1).max(2000),
  })
  .strict();
