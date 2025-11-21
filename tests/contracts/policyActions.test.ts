import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/contractsService", () => ({
  contractsService: {
    createPolicy: vi.fn(),
    deletePolicy: vi.fn(),
    createExampleAgreement: vi.fn(),
    deleteExampleAgreement: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { contractsService } from "@/lib/services/contractsService";
import {
  createPolicyAction,
  deletePolicyAction,
  createExampleAction,
} from "@/app/contracts/policies/actions";

describe("policy actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid policy payloads", async () => {
    const result = await createPolicyAction({ description: "" });
    expect(result.success).toBe(false);
    expect(contractsService.createPolicy).not.toHaveBeenCalled();
  });

  it("creates policy when payload is valid", async () => {
    const result = await createPolicyAction({ description: "Payment terms are Net 30." });
    expect(result.success).toBe(true);
    expect(contractsService.createPolicy).toHaveBeenCalledWith({
      description: "Payment terms are Net 30.",
    });
  });

  it("rejects invalid example agreements", async () => {
    const result = await createExampleAction({
      name: "",
      type: "MSA",
      content: "",
    });
    expect(result.success).toBe(false);
    expect(contractsService.createExampleAgreement).not.toHaveBeenCalled();
  });

  it("accepts valid example agreements", async () => {
    const payload = {
      name: "Standard MSA",
      type: "MSA",
      content: "Agreement body...",
    };
    const result = await createExampleAction(payload);
    expect(result.success).toBe(true);
    expect(contractsService.createExampleAgreement).toHaveBeenCalledWith(payload);
  });

  it("rejects invalid policy ids", async () => {
    const result = await deletePolicyAction("bad-id");
    expect(result.success).toBe(false);
    expect(contractsService.deletePolicy).not.toHaveBeenCalled();
  });
});

