import type { EstimateStage } from "../zod/estimates";
import { estimateStageOrder } from "../zod/estimates";
import type { AgreementStatus } from "@prisma/client";

const estimateStageIndex = new Map<EstimateStage, number>(
  estimateStageOrder.map((stage, index) => [stage, index]),
);

const allowedAgreementTransitions: Record<AgreementStatus, AgreementStatus[]> = {
  REVIEW: ["APPROVED"],
  APPROVED: ["REVIEW"],
};

export class ReadOnlyStageError extends Error {
  readonly code = "read_only_stage";

  constructor(message: string) {
    super(message);
    this.name = "ReadOnlyStageError";
  }
}

export type EstimateMutableEntity = EstimateStage;

interface EstimateEntityRule {
  label: string;
  requiredStage?: EstimateStage;
}

const ESTIMATE_ENTITY_RULES: Record<EstimateMutableEntity, EstimateEntityRule> = {
  ARTIFACTS: {
    label: "project artifacts",
    requiredStage: "ARTIFACTS",
  },
  BUSINESS_CASE: {
    label: "Business Case draft",
    requiredStage: "BUSINESS_CASE",
  },
  REQUIREMENTS: {
    label: "Requirements draft",
    requiredStage: "REQUIREMENTS",
  },
  SOLUTION: {
    label: "Solution Architecture draft",
    requiredStage: "SOLUTION",
  },
  EFFORT: {
    label: "effort model (WBS items)",
    requiredStage: "EFFORT",
  },
  QUOTE: {
    label: "project quote",
    requiredStage: "QUOTE",
  },
};

function getStageIndex(stage: EstimateStage): number {
  const index = estimateStageIndex.get(stage);
  if (index === undefined) {
    throw new Error(`Unknown estimate stage: ${stage}`);
  }
  return index;
}

export interface EstimateMutationContext {
  projectId: string;
  projectStage: EstimateStage;
  entity: EstimateMutableEntity;
  hasApprovedAgreement?: boolean;
}

export function assertEstimateEntityMutable(context: EstimateMutationContext) {
  const rule = ESTIMATE_ENTITY_RULES[context.entity];
  if (!rule) {
    throw new Error(`No stage rule defined for entity "${context.entity}"`);
  }

  if (rule.requiredStage) {
    const currentIndex = getStageIndex(context.projectStage);
    const requiredIndex = getStageIndex(rule.requiredStage);

    if (currentIndex < requiredIndex) {
      throw new ReadOnlyStageError(
        `Project ${context.projectId} has not reached the ${rule.requiredStage} stage yet. Advance the project before updating ${rule.label}.`,
      );
    }

  }
}

export type ContractMutableEntity =
  | "agreement"
  | "agreementVersion"
  | "agreementNotes";

const CONTRACT_ENTITY_RULES: Record<
  ContractMutableEntity,
  { label: string; lockedStatuses: AgreementStatus[] }
> = {
  agreement: {
    label: "agreement metadata",
    lockedStatuses: ["APPROVED"],
  },
  agreementVersion: {
    label: "agreement versions",
    lockedStatuses: ["APPROVED"],
  },
  agreementNotes: {
    label: "agreement notes",
    lockedStatuses: ["APPROVED"],
  },
};

export interface ContractMutationContext {
  agreementId: string;
  entity: ContractMutableEntity;
  status: AgreementStatus;
}

export function assertContractEntityMutable(context: ContractMutationContext) {
  const rule = CONTRACT_ENTITY_RULES[context.entity];
  if (!rule) {
    throw new Error(`No contract rule defined for entity "${context.entity}"`);
  }

  if (rule.lockedStatuses.includes(context.status)) {
    throw new ReadOnlyStageError(
      `Agreement ${context.agreementId} is ${context.status}, so ${rule.label} cannot be changed.`,
    );
  }
}

export function assertAgreementStatusTransition(
  agreementId: string,
  currentStatus: AgreementStatus,
  nextStatus: AgreementStatus,
) {
  if (currentStatus === nextStatus) {
    return;
  }

  const allowedTargets = allowedAgreementTransitions[currentStatus];
  if (!allowedTargets || !allowedTargets.includes(nextStatus)) {
    throw new ReadOnlyStageError(
      `Agreement ${agreementId} cannot transition from ${currentStatus} to ${nextStatus}.`,
    );
  }
}

