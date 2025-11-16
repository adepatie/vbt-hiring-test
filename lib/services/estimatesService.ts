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
  wbsItemInputSchema,
  wbsItemSchema,
} from "../zod/estimates";
import prisma from "../db";
import type { EstimateStage } from "../zod/estimates";

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

export const estimatesService = {
  async listProjects() {
    const projects = await prisma.project.findMany({
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
        },
        stageHistory: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!project) {
      throw new NotFoundError("Project", projectId);
    }

    const { stageHistory, ...rest } = project;

    return projectDetailSchema.parse({
      ...rest,
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

    await ensureProject(data.projectId);
    const delegate = mapStageToDelegate(data.stage);
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
    await ensureProject(data.projectId);

    const record = await prisma.quote.upsert({
      where: { projectId: data.projectId },
      update: {
        rates: data.rates ?? undefined,
        paymentTerms:
          data.paymentTerms === undefined ? undefined : data.paymentTerms ?? null,
        timeline:
          data.timeline === undefined ? undefined : data.timeline ?? null,
        total: data.total === undefined ? undefined : data.total ?? null,
        delivered: data.delivered ?? undefined,
      },
      create: {
        projectId: data.projectId,
        rates: data.rates ?? null,
        paymentTerms: data.paymentTerms ?? null,
        timeline: data.timeline ?? null,
        total: data.total ?? null,
        delivered: data.delivered ?? false,
      },
    });

    return quoteSchema.parse(record);
  },

  async addArtifact(input: unknown) {
    const data = artifactInputSchema.parse(input);
    await ensureProject(data.projectId);

    const artifact = await prisma.artifact.create({
      data: {
        projectId: data.projectId,
        type: data.type,
        content: data.content ?? null,
        url: data.url ?? null,
      },
    });

    return artifactSchema.parse(artifact);
  },

  async removeArtifact(projectId: string, artifactId: string) {
    await ensureProject(projectId);
    const artifact = await prisma.artifact.findUnique({
      where: { id: artifactId },
    });

    if (!artifact || artifact.projectId !== projectId) {
      throw new NotFoundError("Artifact", artifactId);
    }

    await prisma.artifact.delete({ where: { id: artifactId } });

    return { id: artifactId };
  },

  async updateWbsItems(projectId: string, items: unknown) {
    await ensureProject(projectId);
    const parsedItems = z.array(wbsItemInputSchema).parse(items);
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
        if (item.id && existingIds.has(item.id)) {
          await tx.wBSItem.update({
            where: { id: item.id },
            data: {
              task: item.task,
              role: item.role,
              hours: item.hours,
            },
          });
        } else {
          await tx.wBSItem.create({
            data: {
              projectId,
              task: item.task,
              role: item.role,
              hours: item.hours,
            },
          });
        }
      }
    });

    const updatedItems = await prisma.wBSItem.findMany({
      where: { projectId },
      orderBy: { task: "asc" },
    });

    return updatedItems.map((item) => wbsItemSchema.parse(item));
  },

  async advanceStage(projectId: string, targetStage: EstimateStage) {
    const project = await ensureProject(projectId);
    assertStageProgression(project.stage as EstimateStage, targetStage);

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

