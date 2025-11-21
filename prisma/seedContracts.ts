import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedPolicies() {
  console.log("Seeding policy rules...");

  const policies = [
    "All invoices are due Net 30 unless otherwise agreed in writing.",
    "Net 45 payment terms may be accepted upon request.",
    "A 2% early-payment discount applies if the Client pays within 10 days.",
    "The Client owns all project-specific deliverables created under the agreement.",
    "The Vendor retains ownership of all pre-existing intellectual property.",
    "The Vendor retains ownership of generalized know-how, internal tools, and templates.",
    "The Client receives a non-exclusive, non-transferable license to use Vendor pre-existing tools solely as integrated into the deliverables.",
    "Each party provides indemnification only for third-party intellectual property infringement caused by its own materials.",
    "No party provides broad or one-sided indemnification.",
    "Total Vendor liability is capped at the fees paid by the Client in the preceding 12 months.",
    "Neither party is liable for consequential, incidental, special, or punitive damages.",
    "Both parties must keep non-public information confidential.",
    "Confidentiality obligations survive for two years after termination.",
    "Neither party may solicit the other’s employees for 12 months following the engagement.",
    "Non-solicitation restrictions do not apply to general, non-targeted job postings.",
    "The agreement is governed by the laws of Florida.",
    "Disputes are resolved exclusively in the state or federal courts of Miami-Dade County, Florida.",
  ];

  for (const description of policies) {
    const existing = await prisma.policyRule.findFirst({
      where: { description },
    });

    if (!existing) {
      await prisma.policyRule.create({
        data: { description },
      });
    }
  }
  console.log(`Seeded ${policies.length} policy rules.`);
}

export async function seedExampleAgreements() {
  console.log("Seeding example agreements...");

  const msaContent = `
MASTER SERVICES AGREEMENT

This Master Services Agreement ("Agreement") is made between VBT Consulting ("Provider") and Client ("Client").

1. SERVICES
Provider agrees to perform services as described in Statements of Work (SOW) executed by both parties.

2. PAYMENT TERMS
Client shall pay all undisputed invoices within thirty (30) days of receipt. Late payments shall accrue interest at 1.5% per month.

3. INTELLECTUAL PROPERTY
Upon full payment of all fees, Provider assigns to Client all right, title, and interest in the Deliverables. Provider retains all background IP.

4. CONFIDENTIALITY
Each party shall protect the other's Confidential Information with the same degree of care it uses for its own, but no less than reasonable care.

5. LIMITATION OF LIABILITY
EXCEPT FOR INDEMNIFICATION OBLIGATIONS, NEITHER PARTY'S LIABILITY SHALL EXCEED THE FEES PAID IN THE 12 MONTHS PRIOR TO THE CLAIM.

6. GOVERNING LAW
This Agreement is governed by the laws of the State of Delaware.
  `.trim();

  const sowContent = `
STATEMENT OF WORK #1

This SOW is governed by the Master Services Agreement dated [DATE].

1. SCOPE OF WORK
Provider shall develop the "Hiring Test App" including Estimates and Contracts workflows.

2. DELIVERABLES
- Source code repository
- Documentation (README, ARCHITECTURE.md)
- Demo video

3. TIMELINE
Start Date: Immediate
End Date: 2 weeks from start

4. FEES
Fixed Fee: $15,000
Payment Schedule:
- 50% upon execution
- 50% upon delivery
  `.trim();

  const msaName = "Standard MSA Template";
  const existingMSA = await prisma.exampleAgreement.findFirst({
    where: { name: msaName },
  });

  if (!existingMSA) {
    await prisma.exampleAgreement.create({
      data: {
        name: msaName,
        type: "MSA",
        content: msaContent,
      },
    });
  }

  const sowName = "Standard SOW Template";
  const existingSOW = await prisma.exampleAgreement.findFirst({
    where: { name: sowName },
  });

  if (!existingSOW) {
    await prisma.exampleAgreement.create({
      data: {
        name: sowName,
        type: "SOW",
        content: sowContent,
      },
    });
  }

  console.log("Seeded example agreements.");
}

async function main() {
  await seedPolicies();
  await seedExampleAgreements();
}

// Only run if executed directly
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
