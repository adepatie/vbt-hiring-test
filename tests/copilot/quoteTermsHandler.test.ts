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
  beforeEach(() => {
    vi.mocked(callProviderLLM).mockReset();
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
});

