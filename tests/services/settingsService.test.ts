import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { Prisma } from "@prisma/client";

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    quoteSettings: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}));

const mockRevalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: mockRevalidateTag,
  unstable_cache: vi.fn((fn) => fn),
}));

const ORIGINAL_ENV = process.env.DEFAULT_OVERHEAD_FEE;

describe("settingsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEFAULT_OVERHEAD_FEE = "5.25";
  });

  afterAll(() => {
    process.env.DEFAULT_OVERHEAD_FEE = ORIGINAL_ENV;
  });

  it("returns existing quote settings without creating a new row", async () => {
    const row = {
      id: "singleton",
      overheadFee: new Prisma.Decimal(10),
      updatedBy: "system",
    };
    mockFindUnique.mockResolvedValue(row);

    const { settingsService } = await import("@/lib/services/settingsService");
    const result = await settingsService.getQuoteSettings();

    expect(result).toBe(row);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates the singleton row when missing using DEFAULT_OVERHEAD_FEE", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const createdRow = {
      id: "singleton",
      overheadFee: new Prisma.Decimal(5.25),
      updatedBy: "system",
    };
    mockCreate.mockResolvedValue(createdRow);

    const { settingsService } = await import("@/lib/services/settingsService");
    const result = await settingsService.getQuoteSettings();

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        overheadFee: expect.any(Prisma.Decimal),
        updatedBy: "system",
      }),
    });
    expect(result).toBe(createdRow);
  });

  it("updates quote settings and revalidates the cache tag", async () => {
    mockFindUnique.mockResolvedValue({
      id: "singleton",
      overheadFee: new Prisma.Decimal(5.25),
      updatedBy: "system",
    });
    const updatedRow = {
      id: "singleton",
      overheadFee: new Prisma.Decimal(7.5),
      updatedBy: "alex",
    };
    mockUpdate.mockResolvedValue(updatedRow);

    const { settingsService } = await import("@/lib/services/settingsService");
    const result = await settingsService.updateQuoteSettings({
      overheadFee: 7.5,
      updatedBy: "alex",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "singleton" },
      data: {
        overheadFee: expect.any(Prisma.Decimal),
        updatedBy: "alex",
      },
    });
    expect(result).toBe(updatedRow);
    expect(mockRevalidateTag).toHaveBeenCalledWith("quote-settings");
  });
});


