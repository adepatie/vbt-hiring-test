import { PrismaClient, AgreementType } from "@prisma/client";
import mammoth from "mammoth";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

export async function seedDocs() {
  console.log("Seeding documents from requirements/samples...");

  const samplesDir = path.join(process.cwd(), "requirements/samples");
  if (!fs.existsSync(samplesDir)) {
    console.log("Directory requirements/samples does not exist. Skipping doc ingestion.");
    return;
  }

  const files = fs.readdirSync(samplesDir).filter((file) => file.endsWith(".docx"));

  if (files.length === 0) {
    console.log("No .docx files found in requirements/samples");
    return;
  }

  for (const file of files) {
    const filePath = path.join(samplesDir, file);
    console.log(`Processing ${file}...`);

    try {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      const content = result.value;
      const warnings = result.messages;

      if (warnings.length > 0) {
        console.warn(`Warnings for ${file}:`, warnings);
      }

      // Determine type based on filename convention or default to 'Other'
      let type: AgreementType = "MSA"; // Default
      const upperFile = file.toUpperCase();
      if (upperFile.includes("SOW")) {
        type = "SOW";
      } else if (upperFile.includes("NDA")) {
        type = "NDA";
      }

      // Use filename as name, removing extension
      const name = path.basename(file, ".docx");

      // Check if exists by name
      const existing = await prisma.exampleAgreement.findFirst({
        where: { name },
      });

      if (existing) {
        await prisma.exampleAgreement.update({
          where: { id: existing.id },
          data: {
            content,
            type,
          },
        });
        console.log(`Updated ${name}`);
      } else {
        await prisma.exampleAgreement.create({
          data: {
            name,
            type,
            content,
          },
        });
        console.log(`Created ${name}`);
      }
      
    } catch (error) {
      console.error(`Failed to process ${file}:`, error);
    }
  }

  console.log(`Processed ${files.length} documents.`);
}

// If run directly
if (require.main === module) {
  seedDocs()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
