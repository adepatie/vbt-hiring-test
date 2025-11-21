import { describe, expect, it } from "vitest";

import {
  quoteInputSchema,
  updateWbsItemsWithRolesSchema,
} from "@/lib/zod/estimates";
import {
  upsertWbsItemsSchema,
  removeWbsItemsSchema,
} from "@/lib/mcp/schemas";

describe("quoteInputSchema", () => {
  it("rejects derived or disallowed fields", () => {
    expect(() =>
      quoteInputSchema.parse({
        projectId: "ckproj00000000000000000000",
        overheadFee: 1000,
        total: 99999,
      }),
    ).toThrow();
  });
});

describe("upsertWbsItemsSchema", () => {
  it("enforces row count caps", () => {
    const items = Array.from({ length: 61 }, (_, idx) => ({
      task: `Task ${idx}`,
      roleName: "Delivery Lead",
      roleRate: 200,
      hours: 8,
    }));

    expect(() =>
      upsertWbsItemsSchema.parse({
        projectId: "ckproj00000000000000000000",
        items,
      }),
    ).toThrow("Cannot update more than 60 WBS rows");
  });
});

describe("updateWbsItemsWithRolesSchema", () => {
  it("accepts items that only include roleId", () => {
    expect(() =>
      updateWbsItemsWithRolesSchema.parse({
        projectId: "ckproj00000000000000000000",
        items: [
          {
            id: "ckitem00000000000000000000",
            task: "Discovery",
            roleId: "ckrole00000000000000000000",
            hours: 8,
          },
        ],
      }),
    ).not.toThrow();
  });

  it("requires a roleId or roleName", () => {
    expect(() =>
      updateWbsItemsWithRolesSchema.parse({
        projectId: "ckproj00000000000000000000",
        items: [
          {
            id: "ckitem00000000000000000000",
            task: "Discovery",
            hours: 8,
          },
        ],
      }),
    ).toThrow("roleId or roleName");
  });
});

describe("removeWbsItemsSchema", () => {
  it("requires at least one id", () => {
    expect(() =>
      removeWbsItemsSchema.parse({
        projectId: "ckproj00000000000000000000",
        itemIds: [],
      }),
    ).toThrow("at least one WBS row id");
  });

  it("limits removals to 60 ids", () => {
    const ids = Array.from({ length: 61 }, (_, idx) => `ckitem${idx.toString().padStart(21, "0")}`);

    expect(() =>
      removeWbsItemsSchema.parse({
        projectId: "ckproj00000000000000000000",
        itemIds: ids,
      }),
    ).toThrow("Cannot remove more than 60 WBS rows");
  });
});

