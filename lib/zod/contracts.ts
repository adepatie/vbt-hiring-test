import { z } from "zod";

// --- Policy Rules ---

export const createPolicyRuleSchema = z
  .object({
    description: z
      .string()
      .min(5, "Policy rule must be at least 5 characters.")
      .max(2000, "Policy rule is too long."),
  })
  .strict();

export const updatePolicyRuleSchema = z
  .object({
    id: z.string().cuid(),
    description: z.string().min(5).max(2000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

// --- Example Agreements ---

export const createExampleAgreementSchema = z.object({
  name: z.string().min(1, "Name is required."),
  type: z.enum(["MSA", "SOW"]),
  content: z.string().min(10, "Content must be at least 10 characters."),
});

// --- Agreements ---

export const createAgreementSchema = z
  .object({
    type: z.enum(["MSA", "SOW"]),
    counterparty: z
      .string()
      .min(1, "Counterparty is required.")
      .max(200, "Counterparty name is too long."),
    projectId: z.string().cuid().optional(),
  })
  .strict();

export const updateAgreementStatusSchema = z
  .object({
    id: z.string().cuid(),
    status: z.enum(["REVIEW", "APPROVED"]),
  })
  .strict();

// --- Versions ---

export const createAgreementVersionSchema = z
  .object({
    agreementId: z.string().cuid(),
    content: z
      .string()
      .min(1, "Content cannot be empty.")
      .max(200000, "Content is too long."),
    changeNote: z.string().max(2000).optional(),
  })
  .strict();

// --- Proposals (for Review) ---

export const proposalSchema = z.object({
  id: z.string(),
  originalText: z.string(),
  proposedText: z.string(),
  rationale: z.string(),
});

export type Proposal = z.infer<typeof proposalSchema>;
