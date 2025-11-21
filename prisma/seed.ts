import { PrismaClient } from "@prisma/client";
import { seedDocs } from "./seedDocs";
import { seedPolicies } from "./seedContracts";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Main Seed (App Init)...");
  
  // Seed Policy Rules
  await seedPolicies();

  // Ingest Sample Agreements
  await seedDocs();

  const defaultOverhead = Number(process.env.DEFAULT_OVERHEAD_FEE ?? 0);
  await prisma.quoteSettings.upsert({
    where: { id: "singleton" },
    create: {
      overheadFee: defaultOverhead,
      updatedBy: "seed",
    },
    update: {
      overheadFee: defaultOverhead,
      updatedBy: "seed",
    },
  });

  console.log("✅ Main Seed finished.");
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
