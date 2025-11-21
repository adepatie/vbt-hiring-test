import fs from "node:fs";
import path from "node:path";

import type { Prisma } from "@prisma/client";
import { PrismaClient, EstimateStage } from "@prisma/client";
import { DEFAULT_ROLE_DEFINITIONS } from "../lib/services/rolesConfig";

const SAMPLE_DIR = path.join(process.cwd(), "requirements", "samples");
const SAMPLE_FILES = [
  "sample-artifact1.md",
  "sample-artifact2.md",
  "sample-artifact3.md",
  "sample-artifact4.md",
];

const PROVENANCE_TAG = (label: string) =>
  `[AI-generated summary of uploaded artifact '${label}']`;
const ARTIFACT_CONTENT_LIMIT = 9_500; // leave room for provenance footer

type SeedSize = "base" | "large";

export interface SeedOptions {
  size?: SeedSize;
}

export interface SeedSummary {
  roles: Array<{ id: string; name: string; rate: number }>;
  projects: Record<
    string,
    {
      id: string;
      name: string;
      stage: EstimateStage;
    }
  >;
}

type SeedRoleDefinition = (typeof DEFAULT_ROLE_DEFINITIONS)[number];

interface SeedArtifactDefinition {
  type: string;
  originalName: string;
  content: string;
  mimeType?: string | null;
}

interface SeedStageHistoryEntry {
  from: EstimateStage;
  to: EstimateStage;
}

interface SeedProjectDefinition {
  slug: string;
  data: Prisma.ProjectCreateInput;
  wbs?: Array<{
    task: string;
    hours: number;
    role: string;
  }>;
  quote?: {
    paymentTerms: string;
    timeline: string;
    delivered: boolean;
    overheadFee: number;
  };
}

interface SeedDataset {
  roles: SeedRoleDefinition[];
  projects: SeedProjectDefinition[];
}

const sampleMarkdowns = SAMPLE_FILES.reduce<Record<string, string>>(
  (acc, file) => {
    const fullPath = path.join(SAMPLE_DIR, file);
    try {
      acc[file] = fs.readFileSync(fullPath, "utf-8");
    } catch (error) {
      console.warn(
        `[seed] Could not load ${file}:`,
        error instanceof Error ? error.message : error,
      );
    }
    return acc;
  },
  {},
);

function sampleSegment(file: string, startLine = 0, lineCount?: number) {
  const content = sampleMarkdowns[file];
  if (!content) {
    return `Sample file ${file} not found while generating seed artifacts.`;
  }
  const lines = content.split("\n");
  const end = lineCount ? startLine + lineCount : undefined;
  const segment = lines.slice(startLine, end).join("\n").trim();
  return segment || content.trim();
}

function withProvenance(
  body: string,
  type: string,
  originalName?: string | null,
) {
  const label = originalName ? `${type} (${originalName})` : type;
  const truncated = body.trim().slice(0, ARTIFACT_CONTENT_LIMIT);
  return `${truncated}\n\n${PROVENANCE_TAG(label)}`;
}

function createArtifacts(defs: SeedArtifactDefinition[]) {
  return defs.map((artifact) => ({
    type: artifact.type,
    originalName: artifact.originalName,
    content: withProvenance(
      artifact.content,
      artifact.type,
      artifact.originalName,
    ).slice(0, 10_000),
    mimeType: artifact.mimeType ?? "text/markdown",
    storedFile: null,
    url: null,
    sizeBytes: artifact.content.length,
  }));
}

function stageHistory(entries: SeedStageHistoryEntry[]) {
  return {
    create: entries.map((entry) => ({
      from: entry.from,
      to: entry.to,
    })),
  };
}

function buildBaseProjects(): SeedProjectDefinition[] {
  const retailArtifacts = createArtifacts([
    {
      type: "transcript",
      originalName: "Retail-Interview-Part1.md",
      content: `# Kickoff Transcript (Part 1)\n${sampleSegment(
        "sample-artifact1.md",
        0,
        8,
      )}`,
    },
    {
      type: "transcript",
      originalName: "Retail-Interview-Part2.md",
      content: `# Kickoff Transcript (Part 2)\n${sampleSegment(
        "sample-artifact1.md",
        8,
      )}`,
    },
    {
      type: "outline",
      originalName: "Discovery-Checklist.md",
      content: `## Discovery Checklist\n${sampleSegment(
        "sample-artifact2.md",
        0,
        6,
      )}`,
    },
    {
      type: "brief",
      originalName: "RPC-Background.md",
      content: `## Background & Objectives\n${sampleSegment(
        "sample-artifact3.md",
        0,
        10,
      )}`,
    },
  ]);

  const hrArtifacts = createArtifacts([
    {
      type: "doc",
      originalName: "Legacy-Constraints.md",
      content: `# Legacy Constraints\n${sampleSegment(
        "sample-artifact3.md",
        8,
        5,
      )}`,
    },
    {
      type: "note",
      originalName: "Ops-Risk-Register.md",
      content: `# Operations Risk Register\n${sampleSegment(
        "sample-artifact4.md",
      )}`,
    },
    {
      type: "outline",
      originalName: "HR-KPI-Integrations.md",
      content: `# KPI / Integration Targets\n${sampleSegment(
        "sample-artifact2.md",
        6,
      )}`,
    },
    {
      type: "transcript",
      originalName: "Leadership-Quotes.md",
      content: `# Leadership Quotes\n${sampleSegment(
        "sample-artifact1.md",
        2,
        6,
      )}`,
    },
    {
      type: "doc",
      originalName: "Assumptions-Appendix.md",
      content: sampleSegment("sample-artifact3.md", 13),
    },
  ]);

  const ecommerceArtifacts = createArtifacts([
    {
      type: "brief",
      originalName: "Migration-Objectives.md",
      content: `# Migration Objectives\n${sampleSegment(
        "sample-artifact3.md",
        0,
        8,
      )}`,
    },
    {
      type: "outline",
      originalName: "Holiday-Readiness.md",
      content: `# Black Friday Checklist\n${sampleSegment(
        "sample-artifact2.md",
        0,
        6,
      )}`,
    },
    {
      type: "outline",
      originalName: "Integration-Targets.md",
      content: `# Integration Targets\n${sampleSegment(
        "sample-artifact2.md",
        6,
      )}`,
    },
    {
      type: "transcript",
      originalName: "Fulfillment-Interview.md",
      content: `# Fulfillment Interview\n${sampleSegment(
        "sample-artifact1.md",
        0,
        10,
      )}`,
    },
    {
      type: "note",
      originalName: "Operational-Risks.md",
      content: `# Operational Risks\n${sampleSegment("sample-artifact4.md")}`,
    },
    {
      type: "doc",
      originalName: "Data-Migration-Plan.md",
      content: `# Data Migration Excerpt\n${sampleSegment(
        "sample-artifact3.md",
        13,
      )}`,
    },
  ]);

  const loyaltyArtifacts = createArtifacts([
    {
      type: "transcript",
      originalName: "Loyalty-App-Interview.md",
      content: `# Loyalty Interview\n${sampleSegment("sample-artifact1.md")}`,
    },
    {
      type: "note",
      originalName: "Design-Inspiration.md",
      content: `# Design Inspiration\n${sampleSegment(
        "sample-artifact2.md",
        0,
        4,
      )}`,
    },
    {
      type: "brief",
      originalName: "Store-Performance-Background.md",
      content: `# Store Background\n${sampleSegment(
        "sample-artifact3.md",
        4,
        6,
      )}`,
    },
    {
      type: "note",
      originalName: "Risk-Matrix.md",
      content: `# Risk Matrix\n${sampleSegment("sample-artifact4.md")}`,
    },
    {
      type: "doc",
      originalName: "Integration-Summary.md",
      content: `# Integration Summary\n${sampleSegment(
        "sample-artifact2.md",
        4,
        6,
      )}`,
    },
    {
      type: "outline",
      originalName: "Objective-Matrix.md",
      content: `# Objective Matrix\n${sampleSegment(
        "sample-artifact3.md",
        10,
        4,
      )}`,
    },
    {
      type: "note",
      originalName: "Ops-Alerts.md",
      content: `# Ops Alerts\n${sampleSegment("sample-artifact4.md", 0, 4)}`,
    },
  ]);

  const playgroundArtifacts = createArtifacts([
    {
      type: "transcript",
      originalName: "Copilot-Playground-Interview.md",
      content: `# Playground Interview\n${sampleSegment(
        "sample-artifact1.md",
        0,
        6,
      )}`,
    },
    {
      type: "note",
      originalName: "Playground-Brief.md",
      content: `# Playground Brief\n${sampleSegment(
        "sample-artifact3.md",
        6,
        6,
      )}`,
    },
  ]);

  return [
    {
      slug: "retail-performance-dashboard",
      data: {
        name: "Retail Performance Dashboard",
        clientName: "ShopMart Inc.",
        stage: "BUSINESS_CASE",
        artifacts: { create: retailArtifacts },
        businessCase: {
          create: {
            content: `# Business Case\n\n## Executive Summary\nShopMart Inc. faces significant latency in decision-making due to manual reporting processes. A real-time dashboard will empower regional managers to intervene immediately when stores underperform.\n\n## Expected Outcomes\n- Reduce reporting latency from 7 days to real-time.\n- Improve regional sales by estimated 5% through faster interventions.\n\n${generateLorem(
              2,
            )}`,
          },
        },
        stageHistory: stageHistory([{ from: "ARTIFACTS", to: "BUSINESS_CASE" }]),
      },
    },
    {
      slug: "legacy-hr-portal-modernization",
      data: {
        name: "Legacy HR Portal Modernization",
        clientName: "Global Corp",
        stage: "EFFORT",
        artifacts: { create: hrArtifacts },
        businessCase: {
          create: {
            approved: true,
            content: `# Business Case\n\nModernizing the HR portal will reduce support tickets by 40% and enable mobile access for the 50% remote workforce.\n\n${generateLorem(
              1,
            )}`,
          },
        },
        requirements: {
          create: {
            approved: true,
            content: `# Requirements\n\n1. SSO Integration with Azure AD.\n2. Mobile-responsive UI.\n3. Payroll stub viewing.\n4. Time-off request workflow.\n\n${generateLorem(
              2,
            )}`,
          },
        },
        solution: {
          create: {
            approved: true,
            content: `# Solution Architecture\n\n- **Frontend**: Next.js / React\n- **Backend**: Node.js API (NestJS)\n- **Database**: PostgreSQL\n- **Auth**: Auth0\n\n${generateLorem(
              3,
            )}`,
          },
        },
        stageHistory: stageHistory([
          { from: "ARTIFACTS", to: "BUSINESS_CASE" },
          { from: "BUSINESS_CASE", to: "REQUIREMENTS" },
          { from: "REQUIREMENTS", to: "SOLUTION" },
          { from: "SOLUTION", to: "EFFORT" },
        ]),
      },
      wbs: [
        { task: "Legacy dependency audit", hours: 32, role: "Solutions Architect" },
        {
          task: "Product backlog refinement",
          hours: 28,
          role: "Senior Product Manager",
        },
        {
          task: "Frontend modernization spike",
          hours: 60,
          role: "Senior Software Engineer",
        },
        { task: "Design system refresh", hours: 36, role: "UI/UX Designer" },
        { task: "Regression automation harness", hours: 28, role: "QA Engineer" },
      ],
    },
    {
      slug: "ecommerce-platform-migration",
      data: {
        name: "E-commerce Platform Migration",
        clientName: "FashionForward",
        stage: "QUOTE",
        artifacts: { create: ecommerceArtifacts },
        businessCase: {
          create: {
            approved: true,
            content: `Business Case Approved.\n${generateLorem(1)}`,
          },
        },
        requirements: {
          create: {
            approved: true,
            content: `Requirements validated.\n${generateLorem(1)}`,
          },
        },
        solution: {
          create: {
            approved: true,
            content: `Architecture defined.\n${generateLorem(1)}`,
          },
        },
        stageHistory: stageHistory([
          { from: "ARTIFACTS", to: "BUSINESS_CASE" },
          { from: "BUSINESS_CASE", to: "REQUIREMENTS" },
          { from: "REQUIREMENTS", to: "SOLUTION" },
          { from: "SOLUTION", to: "EFFORT" },
          { from: "EFFORT", to: "QUOTE" },
        ]),
      },
      wbs: [
        {
          task: "Database Schema Migration Scripts",
          hours: 40,
          role: "Senior Software Engineer",
        },
        {
          task: "Payment Gateway Integration",
          hours: 24,
          role: "Senior Software Engineer",
        },
        {
          task: "System Design & Review",
          hours: 16,
          role: "Solutions Architect",
        },
        {
          task: "Sprint Planning & Management",
          hours: 20,
          role: "Senior Product Manager",
        },
        { task: "Deployment Automation", hours: 18, role: "DevOps Engineer" },
      ],
      quote: {
        paymentTerms: "40% deposit, balance net 30 upon go-live.",
        timeline: "Pilot in 6 weeks, full cutover by November 15.",
        delivered: false,
        overheadFee: 2500,
      },
    },
    {
      slug: "mobile-loyalty-app",
      data: {
        name: "Mobile Loyalty App",
        clientName: "CoffeeChain",
        stage: "QUOTE",
        artifacts: { create: loyaltyArtifacts },
        businessCase: {
          create: {
            approved: true,
            content: `Business Case.\n${generateLorem(1)}`,
          },
        },
        requirements: {
          create: {
            approved: true,
            content: `Requirements.\n${generateLorem(1)}`,
          },
        },
        solution: {
          create: {
            approved: true,
            content: `Solution.\n${generateLorem(1)}`,
          },
        },
        stageHistory: stageHistory([
          { from: "ARTIFACTS", to: "BUSINESS_CASE" },
          { from: "BUSINESS_CASE", to: "REQUIREMENTS" },
          { from: "REQUIREMENTS", to: "SOLUTION" },
          { from: "SOLUTION", to: "EFFORT" },
          { from: "EFFORT", to: "QUOTE" },
        ]),
      },
      wbs: [
        { task: "High-fidelity Mockups", hours: 48, role: "UI/UX Designer" },
        {
          task: "App Development (React Native)",
          hours: 120,
          role: "Senior Software Engineer",
        },
        {
          task: "Backend API for Loyalty Points",
          hours: 64,
          role: "Senior Software Engineer",
        },
        { task: "DevOps pipeline hardening", hours: 24, role: "DevOps Engineer" },
        { task: "QA regression + device lab", hours: 36, role: "QA Engineer" },
        {
          task: "Product launch readiness",
          hours: 28,
          role: "Senior Product Manager",
        },
      ],
      quote: {
        paymentTerms: "50% upfront, 50% upon delivery. Net 30.",
        timeline: "10 weeks total duration. Kickoff June 1st.",
        delivered: true,
        overheadFee: 1800,
      },
    },
    {
      slug: "copilot-playground",
      data: {
        name: "Copilot Playground",
        clientName: "Internal Enablement",
        stage: "ARTIFACTS",
        artifacts: { create: playgroundArtifacts },
      },
    },
  ];
}

function generateLorem(paragraphs = 2) {
  const loremParagraphs = [
    "The system must provide a robust and scalable architecture to support high-volume transaction processing. This involves implementing microservices patterns where appropriate, ensuring loose coupling and high cohesion between components.",
    "User experience is paramount. The interface should be intuitive, responsive, and accessible to users with disabilities, adhering to WCAG 2.1 AA standards. Mobile responsiveness is a key requirement given the field nature of the user base.",
    "Security compliance cannot be compromised. All data at rest must be encrypted using AES-256, and data in transit must use TLS 1.3. Regular penetration testing and vulnerability scanning should be integrated into the CI/CD pipeline.",
    "Integration with legacy systems is a critical success factor. The new platform must consume data from the existing mainframe via a middleware layer, ensuring data consistency and integrity across both systems during the transition period.",
    "Performance targets include a sub-200ms response time for 95% of API requests and the ability to handle a peak load of 10,000 concurrent users without degradation in service quality. Caching strategies should be employed aggressively.",
  ];

  let content = "";
  for (let i = 0; i < paragraphs; i += 1) {
    const index = i % loremParagraphs.length;
    content += `${loremParagraphs[index]}\n\n`;
  }
  return content.trim();
}

function buildStressProjects(count: number): SeedProjectDefinition[] {
  const projects: SeedProjectDefinition[] = [];
  for (let index = 1; index <= count; index += 1) {
    const slug = `stress-sprint-${index}`;
    const artifacts = createArtifacts([
      {
        type: "transcript",
        originalName: `Stress-Interview-${index}.md`,
        content: `# Stress Interview ${index}\n${generateLorem(1)}`,
      },
      {
        type: "note",
        originalName: `Stress-Discovery-${index}.md`,
        content: `# Discovery Notes ${index}\n${generateLorem(1)}`,
      },
      {
        type: "outline",
        originalName: `Stress-Plan-${index}.md`,
        content: `# Stress Plan ${index}\n${generateLorem(1)}`,
      },
    ]);

    projects.push({
      slug,
      data: {
        name: `Stress Test Sprint ${index}`,
        clientName: `Load Testing Co. ${index}`,
        stage: index % 2 === 0 ? "EFFORT" : "BUSINESS_CASE",
        artifacts: { create: artifacts },
        businessCase:
          index % 2 === 0
            ? undefined
            : {
                create: {
                  content: `# Stress Sprint Business Case ${index}\n${generateLorem(
                    2,
                  )}`,
                },
              },
      },
      wbs:
        index % 2 === 0
          ? [
              {
                task: `Discovery Block ${index}`,
                hours: 24 + index,
                role: "Principal Consultant",
              },
              {
                task: `Engineering Block ${index}`,
                hours: 48 + index,
                role: "Senior Software Engineer",
              },
              {
                task: `QA Block ${index}`,
                hours: 12 + index,
                role: "QA Engineer",
              },
            ]
          : undefined,
    });
  }
  return projects;
}

function buildSeedDataset(options?: SeedOptions): SeedDataset {
  const dataset: SeedDataset = {
    // Reuse the canonical role catalog so that seeded environments and
    // runtime defaults share the same role names and rates.
    roles: DEFAULT_ROLE_DEFINITIONS,
    projects: buildBaseProjects(),
  };

  if (options?.size === "large") {
    dataset.projects.push(...buildStressProjects(8));
  }

  return dataset;
}

export async function cleanupDatabase(prisma: PrismaClient) {
  // Use ordered, sequential deletes to avoid FK issues. Wrapping these in a single
  // $transaction can cause the database to execute them in an order that violates
  // foreign key constraints (e.g., deleting projects before business cases).
  await prisma.quote.deleteMany();
  await prisma.wBSItem.deleteMany();
  await prisma.solutionArchitecture.deleteMany();
  await prisma.requirements.deleteMany();
  await prisma.businessCase.deleteMany();
  await prisma.artifact.deleteMany();
  await prisma.stageTransition.deleteMany();
  await prisma.project.deleteMany();
  await prisma.role.deleteMany();
}

export async function seedDatabase(
  prisma: PrismaClient,
  options?: SeedOptions,
): Promise<SeedSummary> {
  await cleanupDatabase(prisma);
  const dataset = buildSeedDataset(options);
  const summary: SeedSummary = {
    roles: [],
    projects: {},
  };

  const roleRecords = await Promise.all(
    dataset.roles.map((role) =>
      prisma.role.create({
        data: role,
      }),
    ),
  );

  summary.roles = roleRecords.map((role) => ({
    id: role.id,
    name: role.name,
    rate: Number(role.rate),
  }));

  const roleLookup = new Map(summary.roles.map((role) => [role.name, role]));

  for (const project of dataset.projects) {
    const record = await prisma.project.create({
      data: project.data,
    });

    summary.projects[project.slug] = {
      id: record.id,
      name: record.name,
      stage: record.stage,
    };

    if (project.wbs?.length) {
      const wbsRows = project.wbs.map((item) => {
        const role = roleLookup.get(item.role);
        if (!role) {
          throw new Error(`Seed role ${item.role} was not created.`);
        }
        return {
          projectId: record.id,
          task: item.task,
          hours: item.hours,
          roleId: role.id,
          roleName: role.name,
        };
      });

      await prisma.wBSItem.createMany({ data: wbsRows });

      if (project.quote) {
        const roleTotals: Record<string, number> = {};
        let subtotal = 0;
        for (const item of project.wbs) {
          const role = roleLookup.get(item.role);
          if (!role) {
            continue;
          }
          const lineTotal = item.hours * role.rate;
          roleTotals[role.name] = (roleTotals[role.name] ?? 0) + lineTotal;
          subtotal += lineTotal;
        }

        await prisma.quote.create({
          data: {
            projectId: record.id,
            paymentTerms: project.quote.paymentTerms,
            timeline: project.quote.timeline,
            delivered: project.quote.delivered,
            overheadFee: project.quote.overheadFee,
            total: subtotal + project.quote.overheadFee,
            rates: roleTotals,
          },
        });
      }
    }
  }

  return summary;
}

export { buildSeedDataset };

