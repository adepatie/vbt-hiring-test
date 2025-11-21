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

runOpenAiSuite("Copilot Chat ↔ MCP ↔ OpenAI integration", () => {
  let projectId: string;
  const prisma = getOpenAiTestPrisma();

  async function callChat(messages: any[], context: any = {}) {
    const body = {
      action: "chat.run",
      payload: {
        messages,
        ...context
      },
    };
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

  it("can run a simple chat conversation", async () => {
    const { response, payload } = await callChat([
      { role: "user", content: "Hello, who are you?" }
    ]);
    
    expect(response.status).toBe(200);
    expect(payload.result).toBeDefined();
    expect(payload.result.messages).toBeDefined();
    expect(payload.result.messages.length).toBeGreaterThan(1);
    const lastMsg = payload.result.messages[payload.result.messages.length - 1];
    expect(lastMsg.role).toBe("assistant");
    // System prompt says "You are VBT's Copilot"
    // But exact wording might vary by model temp, just check response exists
    expect(lastMsg.content.length).toBeGreaterThan(5);
  }, OPENAI_TEST_TIMEOUT_MS);

  it("calls a read tool (roles.list) when asked", async () => {
    const { response, payload } = await callChat([
        { role: "user", content: "List the available delivery roles." }
    ]);

    expect(response.status).toBe(200);
    const messages = payload.result.messages;
    
    // My current implementation returns [Assistant(tool_calls), ToolResult].
    // It does NOT do the final Assistant generation turn.
    
    const toolMsg = messages.find((m: any) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(toolMsg.name).toBe("roles.list");
    expect(toolMsg.content).toContain("roles");
  }, OPENAI_TEST_TIMEOUT_MS);

  it("can search for projects", async () => {
    const { response, payload } = await callChat([
      { role: "user", content: "Search for project 'Copilot Playground'" }
    ]);

    expect(response.status).toBe(200);
    const messages = payload.result.messages;
    const toolMsg = messages.find((m: any) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(toolMsg.name).toBe("estimates.searchProjects");
    expect(toolMsg.content).toContain("Copilot Playground");
  }, OPENAI_TEST_TIMEOUT_MS);

  it("can update WBS items with custom rates (creating new role)", async () => {
    const { response, payload } = await callChat([
      { role: "user", content: "Update the WBS. Add a task 'Special QA' with role 'Super Tester' at rate 150/hr for 10 hours." }
    ], { entityId: projectId, workflow: "estimates" });

    expect(response.status).toBe(200);
    const messages = payload.result.messages;
    const toolMsg = messages.find((m: any) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(toolMsg.name).toBe("estimates.upsertWbsItems");
    
    // Verify the role was created
    const roles = await prisma.role.findMany({ where: { name: "Super Tester" }});
    expect(roles.length).toBe(1);
    expect(Number(roles[0].rate)).toBe(150);
  }, OPENAI_TEST_TIMEOUT_MS);

  it("can create contract version and notes", async () => {
    // First create a contract
    const agreement = await prisma.agreement.create({
      data: {
        projectId,
        type: "SOW",
        counterparty: "Test Client",
        status: "REVIEW",
        versions: {
            create: { versionNumber: 1, content: "Draft 1" }
        }
      }
    });

    // Update notes
    const { response: notesRes, payload: notesPayload } = await callChat([
      { role: "user", content: `Add a note to agreement ${agreement.id}: 'Client requested IP changes'.` }
    ], { entityId: agreement.id, workflow: "contracts" });

    expect(notesRes.status).toBe(200);
    const notesToolMsg = notesPayload.result.messages.find((m: any) => m.role === "tool");
    expect(notesToolMsg).toBeDefined();
    // It might still try to read, but let's hope explicit ID helps.
    // If it reads, it's not necessarily wrong, but makes testing harder without a loop.
    // We can check if ANY tool call was updateNotes, or if we got a list, we can try to simulate the next step?
    // For simplicity, let's just expect updateNotes or allow it to fail if the model is being cautious.
    // But we want to verify the tool works.
    // Let's loosen the assertion to just log if it fails, or retry? 
    // Actually, let's use toolChoice to FORCE the tool if we want to test the tool itself.
    // But we want to test the router.
    
    expect(notesToolMsg.name).toBe("contracts.updateNotes");
    
    // Create version
    const { response: verRes, payload: verPayload } = await callChat([
      { role: "user", content: `Save a new version of agreement ${agreement.id} with content 'Draft 2'.` }
    ], { entityId: agreement.id, workflow: "contracts" });

    expect(verRes.status).toBe(200);
    const verToolMsg = verPayload.result.messages.find((m: any) => m.role === "tool");
    expect(verToolMsg).toBeDefined();
    expect(verToolMsg.name).toBe("contracts.createVersion");

    // Verify DB
    const updatedAgreement = await prisma.agreement.findUnique({ 
        where: { id: agreement.id },
        include: { versions: true }
    });
    
    expect((updatedAgreement?.reviewData as any).notes).toBe("Client requested IP changes");
    expect(updatedAgreement?.versions.length).toBe(2);
    expect(updatedAgreement?.versions.find(v => v.versionNumber === 2)?.content).toBe("Draft 2");

  }, OPENAI_TEST_TIMEOUT_MS);

});

