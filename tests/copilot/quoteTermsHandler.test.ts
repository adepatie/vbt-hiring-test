import { beforeEach, describe, expect, it, vi } from "vitest";
import * as providerClientMock from "./__mocks__/providerClient";

vi.mock("@/lib/mcp/providerClient", () => providerClientMock);
vi.mock("@/lib/services/estimatesService", () => ({
  estimatesService: {
    getProjectMetadata: vi.fn().mockResolvedValue({
      id: "proj_1",
      name: "Sample Project",
      clientName: "Acme",
    }),
  },
}));

import { callProviderLLM } from "@/lib/mcp/providerClient";
import { estimatesService } from "@/lib/services/estimatesService";
import { handleGenerateQuoteTerms } from "@/lib/mcp/handlers/estimates";

describe("handleGenerateQuoteTerms", () => {
  const originalQuoteTokenEnv = process.env.LLM_QUOTE_TERMS_MAX_OUTPUT_TOKENS;

  beforeEach(() => {
    vi.mocked(callProviderLLM).mockReset();
    process.env.LLM_QUOTE_TERMS_MAX_OUTPUT_TOKENS = "2400";
  });

  afterAll(() => {
    if (originalQuoteTokenEnv === undefined) {
      delete process.env.LLM_QUOTE_TERMS_MAX_OUTPUT_TOKENS;
    } else {
      process.env.LLM_QUOTE_TERMS_MAX_OUTPUT_TOKENS = originalQuoteTokenEnv;
    }
  });

  it("parses JSON payload returned by the provider mock", async () => {
    vi.mocked(callProviderLLM).mockResolvedValue({
      content: JSON.stringify({
        paymentTerms: "Net 30",
        timeline: "Deliver in 4 weeks",
      }),
      finishReason: "stop",
      rawResponse: {},
    });

    const result = await handleGenerateQuoteTerms({
      projectId: "proj_1",
      projectName: "Sample Project",
      subtotal: 1200,
      overheadFee: 0,
      total: 1200,
      wbsSummary: "Discovery, Build",
    });

    expect(estimatesService.getProjectMetadata).toHaveBeenCalledWith("proj_1");
    expect(callProviderLLM).toHaveBeenCalled();
    expect(result.content).toContain("paymentTerms");
    expect(result.content).toContain("timeline");
  });

  it("retries with a larger token budget when the LLM hits the token limit", async () => {
    vi.mocked(callProviderLLM)
      .mockResolvedValueOnce({
        content: "",
        finishReason: "length",
        rawResponse: {},
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          paymentTerms: "40% on signing, 60% on delivery",
          timeline: "Two month rollout",
        }),
        finishReason: "stop",
        rawResponse: {},
      });

    const result = await handleGenerateQuoteTerms({
      projectId: "proj_1",
      projectName: "Sample Project",
      subtotal: 5000,
      overheadFee: 500,
      total: 5500,
      wbsSummary: "Build + Deploy",
    });

    expect(callProviderLLM).toHaveBeenCalledTimes(2);
    expect(callProviderLLM).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ maxTokens: 2400 }),
    );
    expect(callProviderLLM).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ maxTokens: 3600 }),
    );
    expect(result.content).toContain("paymentTerms");
  });

  it("throws a clearer error when the LLM keeps running out of tokens", async () => {
    vi.mocked(callProviderLLM).mockResolvedValue({
      content: "",
      finishReason: "length",
      rawResponse: {},
    });

    await expect(
      handleGenerateQuoteTerms({
        projectId: "proj_1",
        projectName: "Sample Project",
        subtotal: 5000,
        overheadFee: 500,
        total: 5500,
        wbsSummary: "Build + Deploy",
      }),
    ).rejects.toThrow(
      "Copilot ran out of tokens before returning quote terms.",
    );

    expect(callProviderLLM).toHaveBeenCalledTimes(2);
  });
});

