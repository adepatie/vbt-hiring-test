import { describe, expect, it } from "vitest";
import { MCP_TOOLS, getOpenAiTools } from "@/lib/mcp/registry";
import { z } from "zod";

describe("MCP Registry", () => {
  it("has schemas for all registered tools", () => {
    for (const [key, tool] of Object.entries(MCP_TOOLS)) {
      expect(tool.name).toBe(key);
      expect(tool.description).toBeDefined();
      expect(tool.schema).toBeInstanceOf(z.ZodType);
      expect(typeof tool.execute).toBe("function");
    }
  });

  it("generates OpenAI-compatible tool definitions", () => {
    const tools = getOpenAiTools();
    expect(tools.length).toBe(Object.keys(MCP_TOOLS).length);

    const businessCaseTool = tools.find(
      (t) => t.function.name === "estimates_generateBusinessCaseFromArtifacts",
    );
    expect(businessCaseTool).toBeDefined();
    expect(businessCaseTool?.function.description).toContain("Business Case");
    
    // zod-to-json-schema output check
    const params = businessCaseTool?.function.parameters as any;
    expect(params).toBeDefined();
    // The root object usually has `type: "object"` and `properties`
    expect(params.type).toBe("object");
    expect(params.properties).toBeDefined();
    expect(params.properties).toHaveProperty("projectId");
  });

  it("correctly defines read tools", () => {
      const readTool = MCP_TOOLS["estimates.getProjectDetails"];
      expect(readTool).toBeDefined();
      expect(readTool.description).toContain("metadata");
  });
});
