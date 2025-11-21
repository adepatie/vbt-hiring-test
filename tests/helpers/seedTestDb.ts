import type { PrismaClient } from "@prisma/client";

import {
  cleanupDatabase,
  seedDatabase,
  type SeedOptions,
  type SeedSummary,
} from "../../prisma/seedData";

export async function seedTestDatabase(
  prisma: PrismaClient,
  options?: SeedOptions,
): Promise<SeedSummary> {
  return seedDatabase(prisma, options);
}

export async function resetTestDatabase(prisma: PrismaClient) {
  await cleanupDatabase(prisma);
}

export function requireSeedProject(
  summary: SeedSummary,
  slug: string,
): { id: string; name: string } {
  const match = summary.projects[slug];
  if (!match) {
    throw new Error(
      `Seed project '${slug}' was not found. Did the seed dataset change?`,
    );
  }
  return { id: match.id, name: match.name };
}

