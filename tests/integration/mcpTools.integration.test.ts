import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { mcpLLMServer } from "@/lib/mcp/server";
import { summarizeArtifactForStorage } from "@/lib/server/artifact-summary";
import {
  OPENAI_TEST_TIMEOUT_MS,
  ensureOpenAiTestEnv,
  shouldRunOpenAiSuite,
  createProjectWithArtifacts,
  getOpenAiTestPrisma,
  resetDatabase,
  seedIntegrationDatabase,
} from "./openaiTestHarness";

const runOpenAiSuite = describe.runIf(shouldRunOpenAiSuite);

runOpenAiSuite("MCP tool integration", () => {
  const prisma = getOpenAiTestPrisma();

  beforeAll(async () => {
    ensureOpenAiTestEnv();
    await seedIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
  });

  it(
    "summarizes artifacts and preserves the provenance banner",
    async () => {
      const rawText =
        "Client Interview Notes:\n- Goal: reduce operational toil.\n- Constraint: keep SaaS spend flat.\n- Risks: legacy API stability.";

      const response = await mcpLLMServer.handle({
        tool: "estimates.summarizeArtifact",
        input: {
          projectId: "proj-openai",
          projectName: "Integration Fixtures Inc.",
          artifactId: "artifact-001",
          artifactType: "Client Interview Notes",
          originalName: "interview.md",
          rawText,
          mode: "storage",
          maxTokens: 200,
        },
      });

      if ("error" in response) {
        throw new Error(`MCP error: ${response.error.message}`);
      }

      const storageSummary = await summarizeArtifactForStorage({
        projectId: "proj-openai",
        projectName: "Integration Fixtures Inc.",
        identity: {
          id: "artifact-001",
          type: "Client Interview Notes",
          originalName: "interview.md",
        },
        rawContent: rawText,
      });

      expect(storageSummary).toMatch(
        /\[(AI-generated summary of uploaded artifact 'Client Interview Notes \(interview\.md\)'|Truncated preview)/,
      );
    },
    OPENAI_TEST_TIMEOUT_MS,
  );

  it(
    "returns structured JSON when using llm.chat with responseFormat=json_object",
    async () => {
      const response = await mcpLLMServer.handle({
        tool: "llm.chat",
        input: {
          systemPrompt:
            "You respond only with a compact JSON object describing API health.",
          messages: [
            {
              role: "user",
              content:
                "Produce {\"status\":\"ok\",\"details\":\"uptime\"} with no commentary.",
            },
          ],
          responseFormat: "json_object",
          maxTokens: 64,
          temperature: 0,
        },
      });

      if ("error" in response) {
        throw new Error(`MCP error: ${response.error.message}`);
      }

      expect(response.result.raw).toBeTruthy();
    },
    OPENAI_TEST_TIMEOUT_MS,
  );

  it(
    "lists, creates, and updates delivery roles via MCP tools",
    async () => {
      const listResponse = await mcpLLMServer.handle({
        tool: "roles.list",
        input: {},
      });

      if ("error" in listResponse) {
        throw new Error(`MCP error: ${listResponse.error.message}`);
      }

      const listPayload = JSON.parse(listResponse.result.content ?? "{}");
      expect(Array.isArray(listPayload.roles)).toBe(true);
      const baseCount = listPayload.roles.length;

      const createResponse = await mcpLLMServer.handle({
        tool: "roles.create",
        input: { name: "Automation Engineer", rate: 155.5 },
      });

      if ("error" in createResponse) {
        throw new Error(`MCP error: ${createResponse.error.message}`);
      }

      const createdRole = JSON.parse(createResponse.result.content ?? "{}").role;
      expect(createdRole?.name).toBe("Automation Engineer");

      const updateResponse = await mcpLLMServer.handle({
        tool: "roles.update",
        input: { roleId: createdRole.id, rate: 158 },
      });

      if ("error" in updateResponse) {
        throw new Error(`MCP error: ${updateResponse.error.message}`);
      }

      const updatedRole = JSON.parse(updateResponse.result.content ?? "{}").role;
      expect(updatedRole?.rate).toBe(158);

      const secondList = await mcpLLMServer.handle({
        tool: "roles.list",
        input: {},
      });

      if ("error" in secondList) {
        throw new Error(`MCP error: ${secondList.error.message}`);
      }

      const secondPayload = JSON.parse(secondList.result.content ?? "{}");
      expect(secondPayload.roles.length).toBeGreaterThan(baseCount);
    },
    OPENAI_TEST_TIMEOUT_MS,
  );

  it(
    "drafts a Solution Architecture when a Business Case and Requirements exist",
    async () => {
      const { project } = await createProjectWithArtifacts(
        {
          projectName: "Solution Architecture Fixture",
          stage: "REQUIREMENTS",
        },
        prisma,
      );

      await prisma.businessCase.create({
        data: {
          projectId: project.id,
          content:
            "Business Case summary describing modernization goals, ROI, and executive mandate.",
          approved: false,
        },
      });

      await prisma.requirements.create({
        data: {
          projectId: project.id,
          content:
            "Functional requirements include API consolidation and unified identity. Non-functional requirements emphasize scale and availability.",
          approved: false,
        },
      });

      const response = await mcpLLMServer.handle({
        tool: "estimates.generateSolutionArchitecture",
        input: {
          projectId: project.id,
          projectName: project.name,
          instructions: "Call out cloud-native architecture and sequencing.",
        },
      });

      if ("error" in response) {
        throw new Error(`MCP error: ${response.error.message}`);
      }

      expect(response.result.content?.length ?? 0).toBeGreaterThan(50);
    },
    OPENAI_TEST_TIMEOUT_MS,
  );

  it(
    "generates WBS items when the Solution draft exists",
    async () => {
      const { project } = await createProjectWithArtifacts(
        {
          projectName: "Effort Fixture",
          stage: "SOLUTION",
        },
        prisma,
      );

      await prisma.businessCase.create({
        data: {
          projectId: project.id,
          content: "Business Case content for WBS generation.",
          approved: false,
        },
      });

      await prisma.requirements.create({
        data: {
          projectId: project.id,
          content: "Requirements content focused on automation and QA.",
          approved: false,
        },
      });

      await prisma.solutionArchitecture.create({
        data: {
          projectId: project.id,
          content:
            "Solution draft describing discovery, architecture, build, QA, deployment, and handover phases.",
          approved: false,
        },
      });

      const response = await mcpLLMServer.handle({
        tool: "estimates.generateWbsItems",
        input: {
          projectId: project.id,
          projectName: project.name,
          instructions: "Limit to 8-12 lines covering each project phase.",
        },
      });

      if ("error" in response) {
        throw new Error(`MCP error: ${response.error.message}`);
      }

      const payload = JSON.parse(response.result.content ?? "{}");
      expect(Array.isArray(payload.items)).toBe(true);
      expect(payload.items.length).toBeGreaterThan(4);
      expect(payload.items[0]).toHaveProperty("task");
      expect(payload.items[0]).toHaveProperty("roleId");
    },
    OPENAI_TEST_TIMEOUT_MS,
  );

  it(
    "gets and updates pricing defaults via MCP tools",
    async () => {
      const getResponse = await mcpLLMServer.handle({
        tool: "quote.getPricingDefaults",
        input: {},
      });

      if ("error" in getResponse) {
        throw new Error(`MCP error: ${getResponse.error.message}`);
      }

      const defaults = JSON.parse(getResponse.result.content ?? "{}");
      expect(typeof defaults.overheadFee).toBe("number");
      expect(defaults.overheadFee).toBeGreaterThanOrEqual(0);

      const updateResponse = await mcpLLMServer.handle({
        tool: "quote.updatePricingDefaults",
        input: { overheadFee: 5000 },
      });

      if ("error" in updateResponse) {
        throw new Error(`MCP error: ${updateResponse.error.message}`);
      }

      const updated = JSON.parse(updateResponse.result.content ?? "{}");
      expect(updated.overheadFee).toBe(5000);
    },
    OPENAI_TEST_TIMEOUT_MS,
  );

  it(
    "generates quote terms when WBS items exist",
    async () => {
      const { project } = await createProjectWithArtifacts(
        {
          projectName: "Quote Generation Fixture",
          stage: "EFFORT",
        },
        prisma,
      );

      const roles = await prisma.role.findMany();
      if (roles.length === 0) {
        throw new Error("No roles exist for WBS items");
      }

      await prisma.wBSItem.createMany({
        data: [
          {
            projectId: project.id,
            task: "Project kickoff and discovery",
            roleName: roles[0].name,
            roleId: roles[0].id,
            hours: 40,
          },
          {
            projectId: project.id,
            task: "Solution architecture design",
            roleName: roles[0].name,
            roleId: roles[0].id,
            hours: 60,
          },
          {
            projectId: project.id,
            task: "Development and testing",
            roleName: roles[0].name,
            roleId: roles[0].id,
            hours: 160,
          },
        ],
      });

      const wbsItems = await prisma.wBSItem.findMany({
        where: { projectId: project.id },
        include: { role: true },
      });

      const subtotal = wbsItems.reduce(
        (sum, item) =>
          sum + item.hours * Number(item.role?.rate ?? 0),
        0,
      );
      const overheadFee = 0;
      const total = subtotal + overheadFee;
      const wbsSummary = wbsItems
        .map(
          (item) =>
            `${item.task} (${item.role?.name ?? "Unknown"}: ${item.hours}h @ $${Number(item.role?.rate ?? 0)}/hr = $${(item.hours * Number(item.role?.rate ?? 0)).toLocaleString()})`,
        )
        .join("\n");

      const response = await mcpLLMServer.handle({
        tool: "quote.generateTerms",
        input: {
          projectId: project.id,
          projectName: project.name,
          subtotal,
          overheadFee,
          total,
          wbsSummary,
        },
      });

      if ("error" in response) {
        throw new Error(`MCP error: ${response.error.message}`);
      }

      const parsed = JSON.parse(response.result.content ?? "{}");
      expect(typeof parsed.paymentTerms).toBe("string");
      expect(typeof parsed.timeline).toBe("string");
      expect(parsed.paymentTerms.length).toBeGreaterThan(50);
      expect(parsed.timeline.length).toBeGreaterThan(50);
    },
    OPENAI_TEST_TIMEOUT_MS,
  );
});


