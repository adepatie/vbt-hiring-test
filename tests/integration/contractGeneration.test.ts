import { contractsService } from "@/lib/services/contractsService";
import { mcpLLMServer } from "@/lib/mcp/server";
import { prisma } from "@/lib/db";

describe("Contracts Generation Integration (OpenAI)", () => {
  let agreementId: string;
  const uniqueSuffix = Date.now().toString();

  beforeAll(async () => {
    // Cleanup - Order matters due to FK constraints
    // We might want to be selective or use a test database where wiping is fine.
    // Assuming the environment is test.
    await prisma.agreementVersion.deleteMany();
    await prisma.agreement.deleteMany();
    await prisma.exampleAgreement.deleteMany();
    await prisma.policyRule.deleteMany();

    // Seed Policy
    await contractsService.createPolicy({
      description: "Payment terms must be Net 30",
    });

    // Seed Example Agreement
    await contractsService.createExampleAgreement({
      name: "Standard SOW Template",
      type: "SOW",
      content: "# Standard SOW\n\n## Scope\nscope_placeholder\n\n## Terms\nstandard_terms_placeholder",
    });
  });

  test("Generate Draft with OpenAI using Context and Instructions", async () => {
    // 1. Create an empty Agreement
    const agreement = await contractsService.createAgreement({
      type: "SOW",
      counterparty: `Test Client ${uniqueSuffix}`,
      // projectId: undefined, // Omitted or undefined is fine for optional()
    });
    agreementId = agreement.id;

    // 2. Call Copilot to generate draft
    // We use the internal MCP server handler directly to simulate the API call
    const response = await mcpLLMServer.handle({
      tool: "contracts.generateDraft",
      input: {
        agreementId: agreement.id,
        instructions: "The scope of work involves building a React Native mobile application. Ensure the payment terms are highlighted.",
      },
    });

    if ("error" in response) {
      throw new Error(`MCP Error: ${JSON.stringify(response.error)}`);
    }

    const content = response.result.content as string;
    
    // 3. Assertions
    expect(response.result).toBeDefined();
    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(100); // Should be a reasonable length

    // Check for Policy Context
    expect(content).toContain("Net 30");

    // Check for Instructions application
    expect(content.toLowerCase()).toContain("react native");
    expect(content.toLowerCase()).toContain("mobile application");

    // Check for Example Agreement usage (structural/content clues)
    // Since it's an LLM, exact matches might vary, but it usually adopts the structure if instructed.
    // The prompt builder explicitly tells it to use examples.
    // We'll check if it picked up on "Terms" or "Scope" sections generally found in the example or standard SOWs.
    expect(content).toMatch(/Scope|Objective/i);
    expect(content).toMatch(/Terms|Payment/i);
  }, 60000); // Increased timeout for LLM call
});

