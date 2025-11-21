import { prisma } from "@/lib/db";
import {
  createPolicyRuleSchema,
  updatePolicyRuleSchema,
  createExampleAgreementSchema,
  createAgreementSchema,
  createAgreementVersionSchema,
  updateAgreementStatusSchema,
} from "../zod/contracts";
import { z } from "zod";
import {
  assertAgreementStatusTransition,
  assertContractEntityMutable,
} from "./stageRules";

const ensureAgreementStatus = async (agreementId: string) => {
  const agreement = await prisma.agreement.findUnique({
    where: { id: agreementId },
    select: { id: true, status: true },
  });

  if (!agreement) {
    throw new Error(`Agreement ${agreementId} was not found.`);
  }

  return agreement.status;
};

export const contractsService = {
  async getDashboardStats() {
    const [count, mostRecent] = await prisma.$transaction([
      prisma.agreement.count(),
      prisma.agreement.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
    ]);

    return {
      count,
      lastUpdated: mostRecent?.updatedAt ?? null,
    };
  },

  // --- Policy Rules ---

  async listPolicies() {
    return prisma.policyRule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async createPolicy(input: z.infer<typeof createPolicyRuleSchema>) {
    const parsed = createPolicyRuleSchema.parse(input);
    return prisma.policyRule.create({
      data: {
        description: parsed.description,
      },
    });
  },

  async deletePolicy(id: string) {
    return prisma.policyRule.update({
      where: { id },
      data: { isActive: false },
    });
  },

  // --- Example Agreements ---

  async listExampleAgreements() {
    return prisma.exampleAgreement.findMany({
      orderBy: { createdAt: "desc" },
    });
  },

  async createExampleAgreement(
    input: z.infer<typeof createExampleAgreementSchema>
  ) {
    const parsed = createExampleAgreementSchema.parse(input);
    return prisma.exampleAgreement.create({
      data: parsed as any,
    });
  },

  async deleteExampleAgreement(id: string) {
    return prisma.exampleAgreement.delete({
      where: { id },
    });
  },

  // --- Agreements ---

  async listAgreements(projectId?: string) {
    return prisma.agreement.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        project: {
          select: { name: true },
        },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  async getAgreement(id: string) {
    return prisma.agreement.findUnique({
      where: { id },
      include: {
        project: true,
        versions: {
          orderBy: { versionNumber: "desc" },
        },
      },
    });
  },

  async createAgreement(input: z.infer<typeof createAgreementSchema>) {
    const parsed = createAgreementSchema.parse(input);
    return prisma.agreement.create({
      data: {
        type: parsed.type,
        counterparty: parsed.counterparty,
        projectId: parsed.projectId,
        status: "APPROVED",
        versions: {
          create: {
            versionNumber: 1,
            content: "", // Starts empty, populated by LLM later
            changeNote: "Initial draft",
          },
        },
      },
    });
  },

  async updateAgreementStatus(
    input: z.infer<typeof updateAgreementStatusSchema>
  ) {
    const parsed = updateAgreementStatusSchema.parse(input);
    const currentStatus = await ensureAgreementStatus(parsed.id);
    assertAgreementStatusTransition(parsed.id, currentStatus, parsed.status);

    return prisma.agreement.update({
      where: { id: parsed.id },
      data: { status: parsed.status },
    });
  },

  async updateAgreementNotes(id: string, notes: string) {
    const agreement = await prisma.agreement.findUnique({ where: { id } });
    if (!agreement) return null;

     assertContractEntityMutable({
       agreementId: id,
       entity: "agreementNotes",
       status: agreement.status,
     });

    const reviewData = (agreement.reviewData as Record<string, any>) || {};
    return prisma.agreement.update({
      where: { id },
      data: {
        reviewData: { ...reviewData, notes },
      },
    });
  },

  // --- Versions ---

  async createVersion(input: z.infer<typeof createAgreementVersionSchema>) {
    const parsed = createAgreementVersionSchema.parse(input);
    const status = await ensureAgreementStatus(parsed.agreementId);
    assertContractEntityMutable({
      agreementId: parsed.agreementId,
      entity: "agreementVersion",
      status,
    });

    // Get latest version number
    const latest = await prisma.agreementVersion.findFirst({
      where: { agreementId: parsed.agreementId },
      orderBy: { versionNumber: "desc" },
    });

    const nextVersion = (latest?.versionNumber ?? 0) + 1;

    return prisma.agreementVersion.create({
      data: {
        agreementId: parsed.agreementId,
        content: parsed.content,
        changeNote: parsed.changeNote,
        versionNumber: nextVersion,
      },
    });
  },

  async getLatestVersion(agreementId: string) {
    return prisma.agreementVersion.findFirst({
      where: { agreementId },
      orderBy: { versionNumber: "desc" },
    });
  },
};
