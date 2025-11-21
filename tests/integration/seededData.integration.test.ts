import { describe, beforeAll, afterAll, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { estimatesService } from "@/lib/services/estimatesService";

import {
  OPENAI_TEST_TIMEOUT_MS,
  ensureOpenAiTestEnv,
  shouldRunOpenAiSuite,
  getOpenAiTestPrisma,
  seedIntegrationDatabase,
  getSeededProjectSlug,
  resetDatabase,
  disconnectOpenAiPrisma,
} from "./openaiTestHarness";
import { GET as quoteExportGet } from "@/app/api/projects/[projectId]/quote/export/route";

const runOpenAiSuite = describe.runIf(shouldRunOpenAiSuite);

runOpenAiSuite("Seeded dataset smoke tests", () => {
  const prisma = getOpenAiTestPrisma();

  beforeAll(async () => {
    ensureOpenAiTestEnv();
    await seedIntegrationDatabase(prisma);
  }, OPENAI_TEST_TIMEOUT_MS);

  afterAll(async () => {
    await resetDatabase(prisma);
    await disconnectOpenAiPrisma();
  });

  it(
    "lists seeded projects and stages",
    async () => {
      const projects = await estimatesService.listProjects();
      expect(projects.length).toBeGreaterThanOrEqual(4);
      const stages = projects.map((project) => project.stage);
      expect(stages).toContain("BUSINESS_CASE");
      expect(stages).toContain("QUOTE");
    },
    OPENAI_TEST_TIMEOUT_MS,
  );

  it(
    "loads a seeded project with provenance-tagged artifacts",
    async () => {
      const retail = getSeededProjectSlug("retail-performance-dashboard");
      const project = await estimatesService.getProjectWithDetails(retail.id);
      expect(project.artifacts.length).toBeGreaterThanOrEqual(2);
      for (const artifact of project.artifacts) {
        expect(artifact.content ?? "").toMatch(/\[AI-generated summary/);
      }
    },
    OPENAI_TEST_TIMEOUT_MS,
  );

  it(
    "exports quotes for seeded quote-stage projects",
    async () => {
      const quoteProject = getSeededProjectSlug("mobile-loyalty-app");
      const request = new NextRequest(
        `http://localhost/api/projects/${quoteProject.id}/quote/export?format=csv`,
      );
      const response = await quoteExportGet(request, {
        params: Promise.resolve({ projectId: quoteProject.id }),
      });
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toMatch(/Project Quote Export/);
      expect(body).toMatch(/Mobile Loyalty App/);
    },
    OPENAI_TEST_TIMEOUT_MS,
  );
});

