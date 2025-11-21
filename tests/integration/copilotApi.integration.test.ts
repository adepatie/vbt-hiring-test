import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST as copilotPost } from "@/app/api/copilot/route";
import {
  OPENAI_TEST_TIMEOUT_MS,
  ensureOpenAiTestEnv,
  getOpenAiTestPrisma,
  resetDatabase,
  shouldRunOpenAiSuite,
  disconnectOpenAiPrisma,
  seedIntegrationDatabase,
  getSeededProjectSlug,
} from "./openaiTestHarness";

const runOpenAiSuite = describe.runIf(shouldRunOpenAiSuite);

runOpenAiSuite("Copilot API ↔ MCP ↔ OpenAI integration", () => {
  let projectId: string;
  const prisma = getOpenAiTestPrisma();

  async function callCopilotAction(body: Record<string, unknown>) {
    const request = new Request("http://localhost/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const response = await copilotPost(request);
    const payload = await response.json();

    return { response, payload };
  }

  beforeAll(async () => {
    ensureOpenAiTestEnv();
    await seedIntegrationDatabase(prisma);
    projectId = getSeededProjectSlug("copilot-playground").id;
  }, OPENAI_TEST_TIMEOUT_MS);

  afterAll(async () => {
    await resetDatabase(prisma);
    await disconnectOpenAiPrisma();
  });

  it(
    "generates and persists a Business Case draft",
    async () => {
      const { response, payload } = await callCopilotAction({
        action: "generateBusinessCaseFromArtifacts",
        payload: {
          projectId,
          instructions:
            "Write a concise executive summary that emphasizes ROI and risks.",
        },
      });

      expect(response.status).toBe(200);
      expect(payload.result?.kind).toBe("business_case_draft");
      expect(payload.result?.draft?.length ?? 0).toBeGreaterThan(50);
      const saved = await prisma.businessCase.findUnique({
        where: { projectId },
      });
      expect(saved?.content?.length ?? 0).toBeGreaterThan(50);
    },
    OPENAI_TEST_TIMEOUT_MS,
  );

  it(
    "generates Requirements after a Business Case exists",
    async () => {
      const { response, payload } = await callCopilotAction({
        action: "generateRequirementsFromBusinessCase",
        payload: {
          projectId,
          instructions: "Focus on integration touchpoints and API limits.",
        },
      });

      expect(response.status).toBe(200);
      expect(payload.result?.kind).toBe("requirements_draft");
      expect(payload.result?.draft?.length ?? 0).toBeGreaterThan(50);
      const saved = await prisma.requirements.findUnique({
        where: { projectId },
      });
      expect(saved?.content?.length ?? 0).toBeGreaterThan(50);
    },
    OPENAI_TEST_TIMEOUT_MS,
  );

  it(
    "generates Solution Architecture after Requirements exist",
    async () => {
      const { response, payload } = await callCopilotAction({
        action: "generateSolutionArchitectureFromRequirements",
        payload: {
          projectId,
          instructions:
            "Highlight integration architecture and delivery phases for the solution.",
        },
      });

      expect(response.status).toBe(200);
      expect(payload.result?.kind).toBe("solution_architecture_draft");
      expect(payload.result?.draft?.length ?? 0).toBeGreaterThan(50);
      const saved = await prisma.solutionArchitecture.findUnique({
        where: { projectId },
      });
      expect(saved?.content?.length ?? 0).toBeGreaterThan(50);
    },
    OPENAI_TEST_TIMEOUT_MS,
  );

  it(
    "generates Effort WBS items after the Solution exists",
    async () => {
      const { response, payload } = await callCopilotAction({
        action: "generateEffortFromSolution",
        payload: {
          projectId,
          instructions:
            "Focus on sequencing discovery, architecture, build, QA, deployment, and project management.",
        },
      });

      expect(response.status).toBe(200);
      expect(payload.result?.kind).toBe("effort_wbs_items");
      expect(Array.isArray(payload.result?.items)).toBe(true);
      expect(payload.result?.items?.length ?? 0).toBeGreaterThan(3);
      expect(payload.result?.items?.[0]).toHaveProperty("roleId");
      expect(payload.result?.items?.[0]).toHaveProperty("roleName");
      const saved = await prisma.wBSItem.findMany({
        where: { projectId },
      });
      expect(saved.length).toBeGreaterThan(3);
      expect(saved.every((item) => item.roleId !== null)).toBe(true);
    },
    OPENAI_TEST_TIMEOUT_MS,
  );

  it(
    "responds to the debugPingLLM action via llm.chat",
    async () => {
      const { response, payload } = await callCopilotAction({
        action: "debugPingLLM",
        payload: {
          message: "Reply with the single word: PONG.",
        },
      });

      expect(response.status).toBe(200);
      expect(payload.result?.kind).toBe("llm_debug_ping");
      const parsed = JSON.parse(payload.result?.content ?? "{}");
      expect(parsed.pong).toBe(true);
    },
    OPENAI_TEST_TIMEOUT_MS,
  );

  it(
    "generates Quote terms after WBS items exist",
    async () => {
      // Ensure we have WBS items first
      const wbsItems = await prisma.wBSItem.findMany({
        where: { projectId },
        include: { role: true },
      });

      if (wbsItems.length === 0) {
        // Create some WBS items if they don't exist
        const roles = await prisma.role.findMany();
        if (roles.length === 0) {
          throw new Error("No roles exist for WBS items");
        }
        await prisma.wBSItem.createMany({
          data: [
            {
              projectId,
              task: "Discovery and requirements gathering",
              roleName: roles[0].name,
              roleId: roles[0].id,
              hours: 40,
            },
            {
              projectId,
              task: "Architecture design and documentation",
              roleName: roles[0].name,
              roleId: roles[0].id,
              hours: 60,
            },
            {
              projectId,
              task: "Development and implementation",
              roleName: roles[0].name,
              roleId: roles[0].id,
              hours: 120,
            },
          ],
        });
      }

      const updatedWbsItems = await prisma.wBSItem.findMany({
        where: { projectId },
        include: { role: true },
      });

      const subtotal = updatedWbsItems.reduce(
        (sum, item) =>
          sum + item.hours * Number(item.role?.rate ?? 0),
        0,
      );
      const overheadFee = 0;
      const total = subtotal + overheadFee;
      const wbsSummary = updatedWbsItems
        .map(
          (item) =>
            `${item.task} (${item.role?.name ?? "Unknown"}: ${item.hours}h @ $${Number(item.role?.rate ?? 0)}/hr = $${(item.hours * Number(item.role?.rate ?? 0)).toLocaleString()})`,
        )
        .join("\n");

      const { response, payload } = await callCopilotAction({
        action: "generateQuoteTerms",
        payload: {
          projectId,
          subtotal,
          overheadFee,
          total,
          wbsSummary,
        },
      });

      expect(response.status).toBe(200);
      expect(payload.result?.kind).toBe("quote_terms");
      expect(payload.result?.paymentTerms?.length ?? 0).toBeGreaterThan(50);
      expect(payload.result?.timeline?.length ?? 0).toBeGreaterThan(50);
    },
    OPENAI_TEST_TIMEOUT_MS,
  );
});


