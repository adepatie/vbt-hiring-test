import { beforeEach, describe, expect, it, vi } from "vitest";

const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

vi.mock("@/lib/mcp/registry", () => {
  const { z } = require("zod");
  const quoteExecuteMock = vi.fn(async () => ({
    content: JSON.stringify({ success: true }),
    finishReason: "stop",
    raw: { ok: true },
  }));

  const wbsExecuteMock = vi.fn(async () => ({
    content: "{}",
    finishReason: "stop",
    raw: {},
  }));

  const tools = {
    "quote.updatePricingDefaults": {
      name: "quote.updatePricingDefaults",
      description: "Update quote defaults",
      schema: z.object({ overheadFee: z.number() }),
      execute: quoteExecuteMock,
    },
    "estimates.generateWbsItems": {
      name: "estimates.generateWbsItems",
      description: "Generate WBS items",
      schema: z.object({ projectId: z.string() }),
      execute: wbsExecuteMock,
    },
  };
  return {
    MCP_TOOLS: tools,
    getOpenAiTools: () => [],
    __toolMocks: {
      quoteExecuteMock,
      wbsExecuteMock,
    },
  };
});

import { executeToolCalls } from "@/lib/copilot/helpers";
import { __toolMocks } from "@/lib/mcp/registry";

const { quoteExecuteMock, wbsExecuteMock } = __toolMocks;

describe("executeToolCalls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("executes allowed tools, runs side-effects, and returns tool messages", async () => {
    const toolCalls = [
      {
        id: "call-1",
        function: {
          name: "quote_updatePricingDefaults",
          arguments: JSON.stringify({ overheadFee: 7.5 }),
        },
      },
    ];

    const result = await executeToolCalls({
      toolCalls,
      openAiToolNameMap: {
        quote_updatePricingDefaults: "quote.updatePricingDefaults",
      },
      allowedToolSet: new Set(["quote.updatePricingDefaults"]),
      workflow: "estimates",
      entityId: "proj_123",
      entityType: "project",
    });

    expect(quoteExecuteMock).toHaveBeenCalledWith({ overheadFee: 7.5 });
    expect(result.toolMessages).toHaveLength(1);
    expect(result.sideEffectMessages).toEqual([
      {
        role: "system",
        content: "[Side Effect] Updated global pricing defaults for future quotes.",
      },
    ]);
    expect(result.shouldRefresh).toBe(true);
  });

  it("blocks tools that are not in the allowed set", async () => {
    const toolCalls = [
      {
        id: "call-1",
        function: {
          name: "quote_updatePricingDefaults",
          arguments: JSON.stringify({ overheadFee: 5 }),
        },
      },
    ];

    const result = await executeToolCalls({
      toolCalls,
      openAiToolNameMap: {
        quote_updatePricingDefaults: "quote.updatePricingDefaults",
      },
      allowedToolSet: new Set(),
    });

    expect(quoteExecuteMock).not.toHaveBeenCalled();
    expect(result.toolMessages[0]?.meta?.status).toBe("blocked");
  });

  it("blocks estimate mutation tools when the project has not reached the required stage", async () => {
    const toolCalls = [
      {
        id: "call-1",
        function: {
          name: "estimates_generateWbsItems",
          arguments: JSON.stringify({ projectId: "proj_1" }),
        },
      },
    ];

    const result = await executeToolCalls({
      toolCalls,
      openAiToolNameMap: {
        estimates_generateWbsItems: "estimates.generateWbsItems",
      },
      allowedToolSet: new Set(["estimates.generateWbsItems"]),
      workflow: "estimates",
      entityId: "proj_1",
      entityType: "project",
      projectStage: "BUSINESS_CASE",
    });

    expect(wbsExecuteMock).not.toHaveBeenCalled();
    expect(result.toolMessages[0]?.meta?.status).toBe("blocked");
    expect(result.sideEffectMessages).toHaveLength(0);
    expect(result.shouldRefresh).toBe(false);
  });
});


