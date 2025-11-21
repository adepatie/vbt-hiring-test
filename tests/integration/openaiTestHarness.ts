import "dotenv/config";

import { PrismaClient, EstimateStage, Prisma } from "@prisma/client";

import type { SeedOptions, SeedSummary } from "../../prisma/seedData";
import {
  requireSeedProject,
  resetTestDatabase,
  seedTestDatabase,
} from "../helpers/seedTestDb";

const RUN_OPENAI_TESTS = process.env.RUN_OPENAI_TESTS === "1";
const HAS_OPENAI_KEY =
  Boolean(process.env.OPENAI_API_KEY) || Boolean(process.env.LLM_API_KEY);

export const shouldRunOpenAiSuite = RUN_OPENAI_TESTS && HAS_OPENAI_KEY;

export const OPENAI_TEST_TIMEOUT_MS = Number(
  process.env.OPENAI_TEST_TIMEOUT ?? 120_000,
);

let prismaClient: PrismaClient | null = null;
let latestSeedSummary: SeedSummary | null = null;

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL_OPENAI ?? process.env.DATABASE_URL;
}

function createPrismaClient() {
  const url = resolveDatabaseUrl();
  if (!url) {
    throw new Error(
      "DATABASE_URL (or DATABASE_URL_OPENAI) must be set to run OpenAI integration tests.",
    );
  }
  return new PrismaClient({
    datasources: {
      db: {
        url,
      },
    },
  });
}

export function getOpenAiTestPrisma() {
  if (!prismaClient) {
    prismaClient = createPrismaClient();
  }
  return prismaClient;
}

export async function disconnectOpenAiPrisma() {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}

export function ensureOpenAiTestEnv() {
  if (!shouldRunOpenAiSuite) {
    throw new Error(
      "Set RUN_OPENAI_TESTS=1 and provide OPENAI_API_KEY (or LLM_API_KEY) to run OpenAI integration tests.",
    );
  }
}

export async function resetDatabase(prisma = getOpenAiTestPrisma()) {
  await resetTestDatabase(prisma);
  latestSeedSummary = null;
}

export async function seedIntegrationDatabase(
  prisma = getOpenAiTestPrisma(),
  options?: SeedOptions,
) {
  latestSeedSummary = await seedTestDatabase(prisma, options);
  return latestSeedSummary;
}

export function getSeededProjectSlug(slug: string) {
  if (!latestSeedSummary) {
    throw new Error(
      "Seed dataset not initialized. Call seedIntegrationDatabase() first.",
    );
  }
  return requireSeedProject(latestSeedSummary, slug);
}

export interface SeedProjectOptions {
  projectName?: string;
  clientName?: string | null;
  stage?: EstimateStage;
  artifactCount?: number;
}

export async function createProjectWithArtifacts(
  options: SeedProjectOptions = {},
  prisma = getOpenAiTestPrisma(),
) {
  const projectName =
    options.projectName ?? `OpenAI Test Project ${Date.now().toString(36)}`;
  const clientName = options.clientName ?? "Integration Fixtures Inc.";
  const targetStage = options.stage ?? "ARTIFACTS";
  const artifactCount = options.artifactCount ?? 2;

  const project = await prisma.project.create({
    data: {
      name: projectName,
      clientName,
      stage: targetStage,
    },
  });

  const artifacts = [];
  for (let index = 0; index < Math.max(2, artifactCount); index += 1) {
    const type =
      index === 0 ? "Client Interview Notes" : `Discovery Artifact ${index + 1}`;
    const content = `Artifact ${index + 1} summary for ${projectName}. Contains scope, goals, and constraints to keep prompts grounded.`;

    const artifact = await prisma.artifact.create({
      data: {
        projectId: project.id,
        type,
        content,
        url: null,
        originalName: `${type.toLowerCase().replace(/\s+/g, "-")}.md`,
        storedFile: `${project.id}/${type
          .toLowerCase()
          .replace(/\s+/g, "-")}.md`,
        mimeType: "text/markdown",
        sizeBytes: content.length,
      },
    });
    artifacts.push(artifact);
  }

  return {
    project,
    artifacts,
  };
}


