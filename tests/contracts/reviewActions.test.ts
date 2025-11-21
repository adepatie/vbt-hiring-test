import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => {
  const agreement = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  return {
    prisma: {
      agreement,
    },
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { saveReviewStateAction } from "@/app/contracts/review/actions";

describe("saveReviewStateAction", () => {
  const findUnique = vi.mocked(prisma.agreement.findUnique);
  const update = vi.mocked(prisma.agreement.update);

  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
  });

  it("assigns deterministic ids when missing and preserves decisions", async () => {
    findUnique.mockResolvedValue({
      reviewData: {
        proposals: [
          {
            id: "prop_existing",
            originalText: "Keep clause",
            proposedText: "Keep clause",
            rationale: "Existing",
            decision: "accepted",
          },
        ],
      },
    });

    update.mockResolvedValue({} as any);

    const result = await saveReviewStateAction("ck123456789012345678901234", [
      {
        originalText: "Old terms",
        proposedText: "New terms",
        rationale: "Need update",
      },
    ]);

    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalled();

    const payload = update.mock.calls[0]?.[0]?.data?.reviewData?.proposals;
    expect(Array.isArray(payload)).toBe(true);
    expect(payload[0].id).toMatch(/^prop_/);
    expect(payload[0].decision).toBe("pending");
  });
});

