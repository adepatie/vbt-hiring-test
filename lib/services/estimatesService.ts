import { Prisma, type Role, type WBSItem } from "@prisma/client";
import { z } from "zod";
import {
  artifactInputSchema,
  artifactSchema,
  businessCaseSchema,
  createProjectInputSchema,
  estimateStageOrder,
  projectDetailSchema,
  projectSchema,
  projectStubSchema,
  quoteInputSchema,
  quoteSchema,
  requirementsSchema,
  solutionArchitectureSchema,
  stageContentInputSchema,
  stageTransitionSchema,
  updateProjectMetadataInputSchema,
  createRoleInputSchema,
  updateRoleInputSchema,
  roleSchema,
  wbsItemInputSchema,
  wbsItemSchema,
  updateWbsItemsWithRolesSchema,
  removeWbsItemsSchema,
} from "../zod/estimates";
import prisma from "../db";
import type { EstimateStage } from "../zod/estimates";
import { deleteArtifactFile } from "../server/artifact-storage";
import {
  summarizeArtifactForStorage,
  hasSummaryProvenance,
} from "../server/artifact-summary";
import { DEFAULT_ROLE_DEFINITIONS } from "./rolesConfig";
import { assertEstimateEntityMutable } from "./stageRules";
import { settingsService } from "./settingsService";

const narrativeStages = new Set<EstimateStage>([
  "BUSINESS_CASE",
  "REQUIREMENTS",
  "SOLUTION",
]);

class EstimatesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EstimatesError";
  }
}

class NotFoundError extends EstimatesError {
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} was not found.`);
    this.name = "NotFoundError";
  }
}

class InvalidStageTransitionError extends EstimatesError {
  constructor(current: EstimateStage, target: EstimateStage) {
    super(
      `Cannot transition from stage ${current} to ${target}. Only forward, sequential transitions are allowed.`,
    );
    this.name = "InvalidStageTransitionError";
  }
}

const ensureProject = async (projectId: string) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError("Project", projectId);
  }

  return project;
};

type ProjectLockState = {
  stage: EstimateStage;
  hasApprovedAgreement: boolean;
};

const getProjectLockState = async (
  projectId: string,
): Promise<ProjectLockState> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      stage: true,
      agreements: {
        where: { status: "APPROVED" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!project) {
    throw new NotFoundError("Project", projectId);
  }

  const linkedAgreements = Array.isArray(
    (project as { agreements?: Array<{ id: string }> }).agreements,
  )
    ? ((project as { agreements: Array<{ id: string }> }).agreements ?? [])
    : [];

  return {
    stage: project.stage as EstimateStage,
    hasApprovedAgreement: linkedAgreements.length > 0,
  };
};

const assertStageProgression = (
  current: EstimateStage,
  target: EstimateStage,
) => {
  const currentIdx = estimateStageOrder.indexOf(current);
  const targetIdx = estimateStageOrder.indexOf(target);

  if (currentIdx === -1 || targetIdx === -1 || targetIdx !== currentIdx + 1) {
    throw new InvalidStageTransitionError(current, target);
  }
};

const mapStageToDelegate = (stage: EstimateStage) => {
  if (stage === "BUSINESS_CASE") {
    return prisma.businessCase;
  }
  if (stage === "REQUIREMENTS") {
    return prisma.requirements;
  }
  if (stage === "SOLUTION") {
    return prisma.solutionArchitecture;
  }
  throw new EstimatesError(`Stage ${stage} does not support narrative content.`);
};

const formatDecimal = (value: Prisma.Decimal | number) =>
  Number(value instanceof Prisma.Decimal ? value : Number(value));

const decimalFromRate = (rate: number) => new Prisma.Decimal(rate.toFixed(2));

const coerceJsonNumber = (value: unknown): number => {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in (value as Record<string, unknown>) &&
    typeof (value as Record<string, unknown>).toNumber === "function"
  ) {
    try {
      return Number((value as any).toNumber());
    } catch {
      /* fall through */
    }
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[, ]/g, ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Number(value);
};

const normalizeQuoteRates = (value: Prisma.JsonValue | null) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value === null
  ) {
    return null;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([role, amount]) => [role, coerceJsonNumber(amount)] as const)
    .filter(([, amount]) => Number.isFinite(amount));

  if (!entries.length) {
    return null;
  }

  return Object.fromEntries(entries) as Record<string, number>;
};

async function ensureDefaultRolesSeeded() {
  const existingCount = await prisma.role.count();
  if (existingCount === 0) {
    await prisma.$transaction(
      DEFAULT_ROLE_DEFINITIONS.map((role) =>
        prisma.role.upsert({
          where: { name: role.name },
          update: {
            name: role.name,
            rate: decimalFromRate(role.rate),
          },
          create: {
            name: role.name,
            rate: decimalFromRate(role.rate),
          },
        }),
      ),
    );
  }
}

const serializeRole = (role: Role) =>
  roleSchema.parse({
    ...role,
    rate: formatDecimal(role.rate),
  });

const presentWbsItem = (
  item: WBSItem & { role: Role | null },
) => {
  if (!item.roleId || !item.role) {
    throw new EstimatesError(
      `WBS item ${item.id} is missing a linked role. Ask Copilot to regenerate or assign roles before proceeding.`,
    );
  }

  return wbsItemSchema.parse({
    id: item.id,
    projectId: item.projectId,
    task: item.task,
    hours: item.hours,
    roleId: item.roleId,
    roleName: item.role.name,
    roleRate: formatDecimal(item.role.rate),
  });
};

async function refreshLegacyArtifactSummaries(project: {
  id: string;
  name: string;
  artifacts: Array<{
    id: string;
    type: string;
    originalName: string | null;
    content: string | null;
  }>;
}) {
  if (!project.artifacts?.length) return;

  const replacements = new Map<string, (typeof project.artifacts)[number]>();

  await Promise.all(
    project.artifacts.map(async (artifact) => {
      if (!artifact.content || hasSummaryProvenance(artifact.content)) {
        return;
      }

      try {
        const summary = await summarizeArtifactForStorage({
          projectId: project.id,
          projectName: project.name,
          identity: {
            id: artifact.id,
            type: artifact.type,
            originalName: artifact.originalName,
          },
          rawContent: artifact.content,
        });

        if (!summary?.trim()) {
          return;
        }

        const updated = await prisma.artifact.update({
          where: { id: artifact.id },
          data: { content: summary },
        });

        replacements.set(artifact.id, updated);
      } catch (error) {
        console.warn("[estimatesService] Failed to refresh legacy artifact summary", {
          artifactId: artifact.id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }),
  );

  if (replacements.size) {
    project.artifacts = project.artifacts.map(
      (artifact) => replacements.get(artifact.id) ?? artifact,
    );
  }
}

const MIN_QUERY_LENGTH = 2;

function expandProjectSearchTerms(raw: string | undefined | null) {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return [trimmed];
  }

  const normalizedWhitespace = trimmed.replace(/\s{2,}/g, " ");
  const withoutSuffix = normalizedWhitespace.replace(/[–—-].*$/, "").trim();
  const firstTwoWords = normalizedWhitespace
    .split(/\s+/)
    .slice(0, 2)
    .join(" ")
    .trim();

  const candidates = new Set(
    [trimmed, normalizedWhitespace, withoutSuffix, firstTwoWords].filter(
      (value) => value && value.length >= MIN_QUERY_LENGTH,
    ),
  );

  return Array.from(candidates);
}

async function _calculateProjectTotals(projectId: string) {
  const wbsItems = await prisma.wBSItem.findMany({
    where: { projectId },
    include: { role: true },
    orderBy: { task: "asc" },
  });

  const roleTotals: Record<string, number> = {};
  let subtotal = 0;

  const itemsWithTotals = wbsItems.map((item) => {
    if (!item.roleId || !item.role) {
      throw new EstimatesError(
        `WBS item ${item.id} is missing a linked role.`,
      );
    }
    const roleName = item.role.name;
    const roleRate = formatDecimal(item.role.rate);
    const lineTotal = item.hours * roleRate;

    roleTotals[roleName] = (roleTotals[roleName] || 0) + lineTotal;
    subtotal += lineTotal;

    return {
      ...item,
      roleRate,
      lineTotal,
    };
  });

  return {
    wbsItems: itemsWithTotals,
    roleTotals, // Role Name -> Total Cost
    subtotal,
  };
}

type WbsItemsWithRolesInput = z.infer<
  typeof updateWbsItemsWithRolesSchema
>["items"];

type NormalizedWbsItemWithRole = {
  id?: string;
  task: string;
  hours: number;
  roleId: string;
  roleName: string;
};

async function normalizeWbsItemsWithRoles(
  items: WbsItemsWithRolesInput,
): Promise<NormalizedWbsItemWithRole[]> {
  const roleCacheById = new Map<string, Role>();
  const roleCacheByName = new Map<string, Role>();

  const rememberRole = (role: Role) => {
    roleCacheById.set(role.id, role);
    roleCacheByName.set(role.name.trim().toLowerCase(), role);
  };

  const fetchRoleById = async (roleId: string) => {
    if (roleCacheById.has(roleId)) {
      return roleCacheById.get(roleId)!;
    }
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (role) rememberRole(role);
    return role;
  };

  const fetchRoleByName = async (roleName: string) => {
    const cacheKey = roleName.trim().toLowerCase();
    if (roleCacheByName.has(cacheKey)) {
      return roleCacheByName.get(cacheKey)!;
    }
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (role) rememberRole(role);
    return role;
  };

  const updateRoleRateIfNeeded = async (
    role: Role,
    incomingRate?: number,
  ) => {
    if (incomingRate === undefined) {
      return role;
    }
    const currentRate = formatDecimal(role.rate);
    if (Math.abs(currentRate - incomingRate) < 1e-6) {
      return role;
    }
    const updated = await prisma.role.update({
      where: { id: role.id },
      data: { rate: decimalFromRate(incomingRate) },
    });
    rememberRole(updated);
    return updated;
  };

  const ensureRoleId = async (item: {
    roleId?: string | null;
    roleName?: string | null;
    roleRate?: number | null;
  }) => {
    if (item.roleId) {
      const existingById = await fetchRoleById(item.roleId);
      if (existingById) {
        await updateRoleRateIfNeeded(existingById, item.roleRate ?? undefined);
        return existingById.id;
      }
      if (!item.roleName) {
        throw new EstimatesError(
          `Role ${item.roleId} does not exist. Provide a roleName (and optional roleRate) so Copilot can create or resolve it.`,
        );
      }
    }

    if (item.roleName) {
      const existingByName = await fetchRoleByName(item.roleName);
      if (existingByName) {
        const updated = await updateRoleRateIfNeeded(
          existingByName,
          item.roleRate ?? undefined,
        );
        return updated.id;
      }

      if (item.roleRate === undefined || item.roleRate === null) {
        throw new EstimatesError(
          `Role "${item.roleName}" does not exist yet. Include roleRate when introducing a new role or reference an existing roleId.`,
        );
      }

      const created = await prisma.role.create({
        data: {
          name: item.roleName,
          rate: decimalFromRate(item.roleRate),
        },
      });
      rememberRole(created);
      return created.id;
    }

    throw new EstimatesError(
      "Each WBS row must include a roleId or roleName so Copilot can determine staffing.",
    );
  };

  const normalized: NormalizedWbsItemWithRole[] = [];
  for (const item of items) {
    const roleId = await ensureRoleId(item);
    const role = roleCacheById.get(roleId);
    if (!role) {
      throw new EstimatesError(`Role ${roleId} could not be loaded.`);
    }
    normalized.push({
      id: item.id,
      task: item.task,
      hours: item.hours,
      roleId,
      roleName: role.name,
    });
  }

  return normalized;
}

export const estimatesService = {
  async getDashboardStats() {
    const [count, mostRecent] = await prisma.$transaction([
      prisma.project.count(),
      prisma.project.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
    ]);

    return {
      count,
      lastUpdated: mostRecent?.updatedAt ?? null,
    };
  },

  async getProjectMetadata(projectId: string) {
    const project = await ensureProject(projectId);
    return projectSchema.parse(project);
  },

  async listProjects() {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return projects.map((project) => projectStubSchema.parse(project));
  },

  async searchProjects(query: string) {
    const searchTerms = expandProjectSearchTerms(query);
    const where =
      searchTerms.length > 0
        ? {
            OR: searchTerms.map((term) => ({
              name: {
                contains: term,
                mode: "insensitive" as const,
              },
            })),
          }
        : {
            name: {
              contains: query,
              mode: "insensitive" as const,
            },
          };

    const projects = await prisma.project.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return projects.map((project) => projectStubSchema.parse(project));
  },

  async getProjectWithDetails(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        artifacts: {
          orderBy: { createdAt: "asc" },
        },
        businessCase: true,
        requirements: true,
        solution: true,
        quote: true,
        wbsItems: {
          orderBy: { task: "asc" },
          include: { role: true },
        },
        stageHistory: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!project) {
      throw new NotFoundError("Project", projectId);
    }

    await refreshLegacyArtifactSummaries(project);

    const { stageHistory, wbsItems, quote, ...rest } = project;

    const normalizedQuote = quote
      ? {
          ...quote,
          overheadFee: formatDecimal(quote.overheadFee),
          rates: normalizeQuoteRates(quote.rates),
        }
      : null;

    return projectDetailSchema.parse({
      ...rest,
      quote: normalizedQuote,
      wbsItems: wbsItems.map(presentWbsItem),
      stageTransitions: stageHistory.map((transition) =>
        stageTransitionSchema.parse(transition),
      ),
    });
  },

  async createProject(input: unknown) {
    const data = createProjectInputSchema.parse(input);
    const project = await prisma.project.create({
      data: {
        name: data.name,
        clientName: data.clientName ?? null,
      },
    });

    return projectSchema.parse(project);
  },

  async updateProjectMetadata(input: unknown) {
    const data = updateProjectMetadataInputSchema.parse(input);
    await ensureProject(data.projectId);

    const project = await prisma.project.update({
      where: { id: data.projectId },
      data: {
        name: data.name,
        clientName:
          data.clientName === undefined ? undefined : data.clientName ?? null,
      },
    });

    return projectSchema.parse(project);
  },

  async saveStageContent(input: unknown) {
    const data = stageContentInputSchema.parse(input);

    if (!narrativeStages.has(data.stage)) {
      throw new EstimatesError(
        `Stage ${data.stage} cannot be saved via saveStageContent.`,
      );
    }

    const lockState = await getProjectLockState(data.projectId);
    assertEstimateEntityMutable({
      projectId: data.projectId,
      projectStage: lockState.stage,
      entity: data.stage,
      hasApprovedAgreement: lockState.hasApprovedAgreement,
    });

    const delegate = mapStageToDelegate(data.stage) as any;
    const payload = {
      content: data.content,
      approved: data.approved ?? false,
      projectId: data.projectId,
    };

    const record = await delegate.upsert({
      where: { projectId: data.projectId },
      update: payload,
      create: payload,
    });

    if (data.stage === "BUSINESS_CASE") {
      return businessCaseSchema.parse(record);
    }
    if (data.stage === "REQUIREMENTS") {
      return requirementsSchema.parse(record);
    }
    return solutionArchitectureSchema.parse(record);
  },

  async saveQuote(input: unknown) {
    const data = quoteInputSchema.parse(input);
    const lockState = await getProjectLockState(data.projectId);
    assertEstimateEntityMutable({
      projectId: data.projectId,
      projectStage: lockState.stage,
      entity: "QUOTE",
      hasApprovedAgreement: lockState.hasApprovedAgreement,
    });

    const { roleTotals, subtotal } = await _calculateProjectTotals(data.projectId);

    const overheadFee = data.overheadFee ?? 0;
    const calculatedTotal = subtotal + overheadFee;

    // The input might override total, but generally we want the calculated one unless explicitly forcing
    // For now we trust the calculation over the input if 'rates' wasn't provided, 
    // but we respect 'overheadFee' input.
    
    const record = await prisma.quote.upsert({
      where: { projectId: data.projectId },
      update: {
        // Store roleTotals as the 'rates' field (JSON) - maps Name -> Cost
        rates: Object.keys(roleTotals).length > 0 ? roleTotals : Prisma.JsonNull,
        paymentTerms:
          data.paymentTerms === undefined ? undefined : data.paymentTerms ?? null,
        timeline:
          data.timeline === undefined ? undefined : data.timeline ?? null,
        total: calculatedTotal,
        overheadFee:
          data.overheadFee === undefined
            ? undefined
            : decimalFromRate(data.overheadFee),
        delivered: data.delivered ?? undefined,
      },
      create: {
        projectId: data.projectId,
        rates: Object.keys(roleTotals).length > 0 ? roleTotals : Prisma.JsonNull,
        paymentTerms: data.paymentTerms ?? null,
        timeline: data.timeline ?? null,
        total: calculatedTotal,
        overheadFee: decimalFromRate(overheadFee),
        delivered: data.delivered ?? false,
      },
    });

    return quoteSchema.parse({
      ...record,
      overheadFee: formatDecimal(record.overheadFee),
      rates: normalizeQuoteRates(record.rates),
    });
  },

  async getQuote(projectId: string) {
    await ensureProject(projectId);
    const quote = await prisma.quote.findUnique({
      where: { projectId },
    });

    if (!quote) return null;

    return quoteSchema.parse({
      ...quote,
      overheadFee: formatDecimal(quote.overheadFee),
      rates: normalizeQuoteRates(quote.rates),
    });
  },

  async getQuoteForExport(projectId: string) {
    await ensureProject(projectId);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        quote: true,
      },
    });

    if (!project) {
      throw new NotFoundError("Project", projectId);
    }

    // Use the shared calculation to get clean WBS items with line totals
    const { wbsItems, subtotal, roleTotals } = await _calculateProjectTotals(projectId);

    const overheadFee = project.quote
      ? formatDecimal(project.quote.overheadFee)
      : 0;
    
    const total = subtotal + overheadFee;

    // Map for export consumption
    const exportItems = wbsItems.map((item) => ({
      task: item.task,
      roleName: item.role!.name,
      roleRate: item.roleRate,
      hours: item.hours,
      lineTotal: item.lineTotal,
    }));

    return {
      projectName: project.name,
      clientName: project.clientName,
      wbsItems: exportItems,
      subtotal,
      overheadFee,
      total,
      paymentTerms: project.quote?.paymentTerms ?? null,
      timeline: project.quote?.timeline ?? null,
      delivered: project.quote?.delivered ?? false,
    };
  },

  async getPricingDefaults() {
    const settings = await settingsService.getQuoteSettings();
    return { overheadFee: formatDecimal(settings.overheadFee) };
  },

  /**
   * Update the global pricing defaults used for *new* quotes.
   *
   * IMPORTANT: This no longer backfills or mutates existing Quote records.
   * Existing persisted quotes keep their overhead fee and total; callers
   * should explicitly regenerate quotes if they want them to reflect new
   * defaults.
   */
  async updatePricingDefaults(input: { overheadFee: number; updatedBy?: string | null }) {
    const updated = await settingsService.updateQuoteSettings({
      overheadFee: input.overheadFee,
      updatedBy: input.updatedBy ?? null,
    });

    return { overheadFee: formatDecimal(updated.overheadFee) };
  },

  async addArtifact(input: unknown) {
    const data = artifactInputSchema.parse(input);
    const lockState = await getProjectLockState(data.projectId);
    assertEstimateEntityMutable({
      projectId: data.projectId,
      projectStage: lockState.stage,
      entity: "ARTIFACTS",
      hasApprovedAgreement: lockState.hasApprovedAgreement,
    });

    const artifact = await prisma.artifact.create({
      data: {
        projectId: data.projectId,
        type: data.type,
        content: data.content ?? null,
        url: data.url ?? null,
        originalName: data.originalName ?? null,
        storedFile: data.storedFile ?? null,
        mimeType: data.mimeType ?? null,
        sizeBytes: data.sizeBytes ?? null,
      },
    });

    return artifactSchema.parse(artifact);
  },

  async removeArtifact(projectId: string, artifactId: string) {
    const lockState = await getProjectLockState(projectId);
    assertEstimateEntityMutable({
      projectId,
      projectStage: lockState.stage,
      entity: "ARTIFACTS",
      hasApprovedAgreement: lockState.hasApprovedAgreement,
    });

    const artifact = await prisma.artifact.findUnique({
      where: { id: artifactId },
    });

    if (!artifact || artifact.projectId !== projectId) {
      throw new NotFoundError("Artifact", artifactId);
    }

    await deleteArtifactFile(artifact.storedFile);
    await prisma.artifact.delete({ where: { id: artifactId } });

    return { id: artifactId };
  },

  async getWbsItems(projectId: string) {
    await ensureProject(projectId);
    const items = await prisma.wBSItem.findMany({
      where: { projectId },
      include: { role: true },
      orderBy: { task: "asc" },
    });
    return items.map(presentWbsItem);
  },

  async updateWbsItems(
    projectId: string,
    items: unknown,
    options?: { lockState?: ProjectLockState; allowMassDelete?: boolean },
  ) {
    const lockState =
      options?.lockState ?? (await getProjectLockState(projectId));
    assertEstimateEntityMutable({
      projectId,
      projectStage: lockState.stage,
      entity: "EFFORT",
      hasApprovedAgreement: lockState.hasApprovedAgreement,
    });

    const parsedItems = z
      .array(wbsItemInputSchema)
      .max(60, "Cannot persist more than 60 WBS rows per update.")
      .parse(items ?? []);

    if (!parsedItems.length) {
      if (!options?.allowMassDelete) {
        throw new EstimatesError(
          "Refusing to delete every WBS row without explicit confirmation. Re-run the request with allowMassDelete enabled if this was intentional.",
        );
      }
      await prisma.wBSItem.deleteMany({ where: { projectId } });
      return [];
    }

    const uniqueRoleIds = Array.from(new Set(parsedItems.map((item) => item.roleId)));
    const roles = await prisma.role.findMany({
      where: { id: { in: uniqueRoleIds } },
    });

    const roleMap = new Map(roles.map((role) => [role.id, role]));

    for (const roleId of uniqueRoleIds) {
      if (!roleMap.has(roleId)) {
        throw new EstimatesError(`Role ${roleId} does not exist.`);
      }
    }

    const existingIds = new Set(
      (
        await prisma.wBSItem.findMany({
          where: { projectId },
          select: { id: true },
        })
      ).map((item) => item.id),
    );
    const incomingIds = parsedItems
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id));

    await prisma.$transaction(async (tx) => {
      if (incomingIds.length) {
        await tx.wBSItem.deleteMany({
          where: { projectId, id: { notIn: incomingIds } },
        });
      } else {
        await tx.wBSItem.deleteMany({ where: { projectId } });
      }

      for (const item of parsedItems) {
        const role = roleMap.get(item.roleId)!;
        if (item.id && existingIds.has(item.id)) {
          await tx.wBSItem.update({
            where: { id: item.id },
            data: {
              task: item.task,
              roleName: role.name,
              roleId: role.id,
              hours: item.hours,
            },
          });
        } else {
          await tx.wBSItem.create({
            data: {
              projectId,
              task: item.task,
              roleName: role.name,
              roleId: role.id,
              hours: item.hours,
            },
          });
        }
      }
    });

    const updatedItems = await prisma.wBSItem.findMany({
      where: { projectId },
      orderBy: { task: "asc" },
      include: { role: true },
    });

    return updatedItems.map(presentWbsItem);
  },

  async updateWbsItemsWithRoles(input: {
    projectId: string;
    items: Array<{
      id?: string;
      task: string;
      roleId?: string | null;
      roleName?: string | null;
      roleRate?: number | null;
      hours: number;
    }>;
  }) {
    const data = updateWbsItemsWithRolesSchema.parse(input);
    const lockState = await getProjectLockState(data.projectId);
    assertEstimateEntityMutable({
      projectId: data.projectId,
      projectStage: lockState.stage,
      entity: "EFFORT",
      hasApprovedAgreement: lockState.hasApprovedAgreement,
    });

    const normalizedItems = await normalizeWbsItemsWithRoles(data.items);
    const replacePayload = normalizedItems.map((item) => ({
      id: item.id,
      task: item.task,
      hours: item.hours,
      roleId: item.roleId,
    }));

    return this.updateWbsItems(data.projectId, replacePayload, { lockState });
  },

  async upsertWbsItemsWithRoles(input: {
    projectId: string;
    items: WbsItemsWithRolesInput;
  }) {
    const data = updateWbsItemsWithRolesSchema.parse(input);
    const lockState = await getProjectLockState(data.projectId);
    assertEstimateEntityMutable({
      projectId: data.projectId,
      projectStage: lockState.stage,
      entity: "EFFORT",
      hasApprovedAgreement: lockState.hasApprovedAgreement,
    });

    if (!data.items.length) {
      return this.getWbsItems(data.projectId);
    }

    const normalizedItems = await normalizeWbsItemsWithRoles(data.items);
    const existingIds = new Set(
      (
        await prisma.wBSItem.findMany({
          where: { projectId: data.projectId },
          select: { id: true },
        })
      ).map((item) => item.id),
    );

    await prisma.$transaction(async (tx) => {
      for (const item of normalizedItems) {
        if (item.id) {
          if (!existingIds.has(item.id)) {
            throw new EstimatesError(
              `WBS item ${item.id} does not belong to project ${data.projectId}.`,
            );
          }
          await tx.wBSItem.update({
            where: { id: item.id },
            data: {
              task: item.task,
              hours: item.hours,
              roleId: item.roleId,
              roleName: item.roleName,
            },
          });
        } else {
          await tx.wBSItem.create({
            data: {
              projectId: data.projectId,
              task: item.task,
              hours: item.hours,
              roleId: item.roleId,
              roleName: item.roleName,
            },
          });
        }
      }
    });

    return this.getWbsItems(data.projectId);
  },

  async removeWbsItems(input: { projectId: string; itemIds: string[] }) {
    const data = removeWbsItemsSchema.parse(input);
    const lockState = await getProjectLockState(data.projectId);
    assertEstimateEntityMutable({
      projectId: data.projectId,
      projectStage: lockState.stage,
      entity: "EFFORT",
      hasApprovedAgreement: lockState.hasApprovedAgreement,
    });

    if (!data.itemIds.length) {
      return this.getWbsItems(data.projectId);
    }

    await prisma.wBSItem.deleteMany({
      where: { projectId: data.projectId, id: { in: data.itemIds } },
    });

    return this.getWbsItems(data.projectId);
  },

  async saveEffortItems(projectId: string, items: unknown) {
    return this.updateWbsItems(projectId, items);
  },

  async getProjectLockContext(projectId: string) {
    const lockState = await getProjectLockState(projectId);
    return {
      projectId,
      stage: lockState.stage,
      hasApprovedAgreement: lockState.hasApprovedAgreement,
      isReadOnly: lockState.hasApprovedAgreement,
    };
  },

  async listRoles() {
    await ensureDefaultRolesSeeded();
    const roles = await prisma.role.findMany({
      orderBy: [{ rate: "desc" }, { name: "asc" }],
    });
    return roles.map(serializeRole);
  },

  async createRole(input: unknown) {
    await ensureDefaultRolesSeeded();
    const data = createRoleInputSchema.parse(input);
    const role = await prisma.role.create({
      data: {
        name: data.name,
        rate: decimalFromRate(data.rate),
      },
    });
    return serializeRole(role);
  },

  async updateRole(input: unknown) {
    await ensureDefaultRolesSeeded();
    const data = updateRoleInputSchema.parse(input);
    const role = await prisma.role.update({
      where: { id: data.id },
      data: {
        name: data.name ?? undefined,
        rate: data.rate === undefined ? undefined : decimalFromRate(data.rate),
      },
    });
    return serializeRole(role);
  },

  async advanceStage(projectId: string, targetStage: EstimateStage) {
    const project = await ensureProject(projectId);
    assertStageProgression(project.stage as EstimateStage, targetStage);

    if (
      project.stage === "ARTIFACTS" &&
      targetStage === "BUSINESS_CASE"
    ) {
      const artifactCount = await prisma.artifact.count({
        where: {
          projectId,
          OR: [{ storedFile: { not: null } }, { content: { not: null } }],
        },
      });

      if (artifactCount < 2) {
        throw new EstimatesError(
          "Upload at least two artifact files before moving to the Business Case stage.",
        );
      }
    }

    const [, updatedProject] = await prisma.$transaction([
      prisma.stageTransition.create({
        data: {
          projectId,
          from: project.stage as EstimateStage,
          to: targetStage,
        },
      }),
      prisma.project.update({
        where: { id: projectId },
        data: { stage: targetStage },
      }),
    ]);

    return projectSchema.parse(updatedProject);
  },
};

export default estimatesService;
