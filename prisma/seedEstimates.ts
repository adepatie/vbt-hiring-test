import { PrismaClient } from "@prisma/client";

import { seedDatabase, type SeedOptions } from "./seedData";

/**
 * Prisma seed entrypoint.
 *
 * This script performs a destructive reset of all Estimates workflow tables
 * (projects, artifacts, narratives, WBS items, quotes, stage history, roles)
 * and then repopulates them with a curated demo dataset from `seedData.ts`.
 *
 * It is safe to run repeatedly in development / test environments, but should
 * not be used against production data unless you explicitly intend to wipe and
 * recreate the schema contents.
 */

function resolveDatasourceUrl() {
  if (process.env.SEED_DATABASE_URL) {
    return process.env.SEED_DATABASE_URL;
  }

  const target = process.env.SEED_DB_TARGET?.toLowerCase();
  if (target === "test") {
    return (
      process.env.DATABASE_URL_TEST ??
      process.env.DATABASE_URL ??
      process.env.DATABASE_URL_OPENAI ??
      null
    );
  }
  if (target === "prod") {
    return (
      process.env.DATABASE_URL_PROD ??
      process.env.DATABASE_URL ??
      process.env.DATABASE_URL_OPENAI ??
      null
    );
  }

  return (
    process.env.DATABASE_URL ??
    process.env.DATABASE_URL_OPENAI ??
    process.env.DATABASE_URL_TEST ??
    null
  );
}

function formatUrlForLog(url: string | null) {
  if (!url) {
    return "(not set)";
  }
  try {
    const parsed = new URL(url);
    const host = `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`;
    const dbName = parsed.pathname.replace("/", "") || "(default)";
    return `${parsed.protocol}//${host}/${dbName}`;
  } catch {
    return "(custom datasource)";
  }
}

function createPrismaClient() {
  const datasourceUrl = resolveDatasourceUrl();
  if (!datasourceUrl) {
    throw new Error(
      "No database URL resolved for seeding. Set DATABASE_URL (or DATABASE_URL_TEST / DATABASE_URL_PROD) or provide SEED_DATABASE_URL explicitly.",
    );
  }

  console.log(`🔌 Seeding database via ${formatUrlForLog(datasourceUrl)}`);
  return new PrismaClient({
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
  });
}

const prisma = createPrismaClient();

function resolveSeedOptions(): SeedOptions {
  const sizeEnv = process.env.SEED_SIZE?.toLowerCase();
  if (sizeEnv === "large") {
    return { size: "large" };
  }
  return { size: "base" };
}

async function main() {
  console.log("🌱 Starting seed...");
  const options = resolveSeedOptions();
  await seedDatabase(prisma, options);
  console.log("✅ Seeding finished.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

