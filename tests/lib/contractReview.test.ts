import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

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

vi.mock("@/lib/services/contractsService", () => ({
  contractsService: {
    createVersion: vi.fn(),
    updateAgreementStatus: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import { contractsService } from "@/lib/services/contractsService";
import { applyAcceptedProposalsToAgreement } from "@/lib/server/contractReview";

const mockAgreementId = "ck123456789012345678901234";

describe("applyAcceptedProposalsToAgreement", () => {
  const findUnique = vi.mocked(prisma.agreement.findUnique);
  const update = vi.mocked(prisma.agreement.update);
  const createVersion = vi.mocked(contractsService.createVersion);
  const updateStatus = vi.mocked(contractsService.updateAgreementStatus);

  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    createVersion.mockReset();
    updateStatus.mockReset();
  });

  it("creates a new version using accepted proposals", async () => {
    findUnique.mockResolvedValue({
      id: mockAgreementId,
      reviewData: {
        proposals: [
          {
            id: "prop_test",
            originalText: "Original clause",
            proposedText: "Updated clause",
            rationale: "Policy fix",
            decision: "accepted",
          },
        ],
      },
      versions: [
        {
          versionNumber: 1,
          content: "Original clause",
        },
      ],
    } as any);
    createVersion.mockResolvedValue({
      id: "ver_2",
      versionNumber: 2,
      content: "Updated clause",
    } as any);

    const result = await applyAcceptedProposalsToAgreement({
      agreementId: mockAgreementId,
    });

    expect(createVersion).toHaveBeenCalledWith({
      agreementId: mockAgreementId,
      content: "Updated clause",
      changeNote: result.changeNote,
    });
    expect(updateStatus).toHaveBeenCalledWith({
      id: mockAgreementId,
      status: "APPROVED",
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: mockAgreementId },
      data: { reviewData: Prisma.JsonNull },
    });
    expect(result.acceptedCount).toBe(1);
    expect(result.finalContent).toBe("Updated clause");
  });

  it("accepts decision overrides before applying", async () => {
    findUnique.mockResolvedValue({
      id: mockAgreementId,
      reviewData: {
        proposals: [
          {
            id: "prop_test",
            originalText: "Original clause",
            proposedText: "Updated clause",
            rationale: "Policy fix",
            decision: "pending",
          },
        ],
      },
      versions: [
        {
          versionNumber: 1,
          content: "Original clause",
        },
      ],
    } as any);
    createVersion.mockResolvedValue({
      id: "ver_2",
      versionNumber: 2,
      content: "Updated clause",
    } as any);

    const result = await applyAcceptedProposalsToAgreement({
      agreementId: mockAgreementId,
      decisions: { prop_test: "accepted" },
      changeNote: "Applied via chat",
    });

    expect(createVersion).toHaveBeenCalledWith({
      agreementId: mockAgreementId,
      content: "Updated clause",
      changeNote: "Applied via chat",
    });
    expect(result.acceptedCount).toBe(1);
    expect(result.changeNote).toBe("Applied via chat");
  });

  it("throws when there are no accepted proposals", async () => {
    findUnique.mockResolvedValue({
      id: mockAgreementId,
      reviewData: {
        proposals: [
          {
            id: "prop_test",
            originalText: "Original clause",
            proposedText: "Updated clause",
            rationale: "Policy fix",
            decision: "rejected",
          },
        ],
      },
      versions: [
        {
          versionNumber: 1,
          content: "Original clause",
        },
      ],
    } as any);

    await expect(
      applyAcceptedProposalsToAgreement({
        agreementId: mockAgreementId,
      }),
    ).rejects.toThrow("No accepted proposals to apply.");
    expect(createVersion).not.toHaveBeenCalled();
  });
});


