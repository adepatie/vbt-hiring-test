import { beforeEach, describe, expect, it, vi } from "vitest";

const agreementCount = vi.fn();
const agreementFindFirst = vi.fn();
const transactionSpy = vi.fn(async (operations: any) => {
  if (typeof operations === "function") {
    return operations(prismaMock);
  }
  return Promise.all(operations);
});

const prismaMock = {
  agreement: {
    count: agreementCount,
    findFirst: agreementFindFirst,
  },
  $transaction: transactionSpy,
};

vi.mock("@/lib/db", () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));

describe("contractsService.getDashboardStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    transactionSpy.mockClear();
  });

  it("returns the agreement count and latest update timestamp", async () => {
    const latest = new Date("2024-03-10T15:00:00.000Z");
    agreementCount.mockResolvedValue(5);
    agreementFindFirst.mockResolvedValue({ updatedAt: latest });

    const { contractsService } = await import("@/lib/services/contractsService");
    const stats = await contractsService.getDashboardStats();

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(stats).toEqual({ count: 5, lastUpdated: latest });
  });

  it("handles cases with no agreements", async () => {
    agreementCount.mockResolvedValue(0);
    agreementFindFirst.mockResolvedValue(null);

    const { contractsService } = await import("@/lib/services/contractsService");
    const stats = await contractsService.getDashboardStats();

    expect(stats.count).toBe(0);
    expect(stats.lastUpdated).toBeNull();
  });
});

