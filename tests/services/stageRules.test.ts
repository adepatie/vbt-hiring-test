import { describe, expect, it } from "vitest";
import type { AgreementStatus } from "@prisma/client";
import {
  ReadOnlyStageError,
  assertContractEntityMutable,
} from "@/lib/services/stageRules";

const ctx = (status: AgreementStatus) => ({
  agreementId: "agreement-123",
  status,
});

describe("assertContractEntityMutable (contracts)", () => {
  it("allows editing agreement notes even when approved", () => {
    expect(() =>
      assertContractEntityMutable({
        ...ctx("APPROVED"),
        entity: "agreementNotes",
      }),
    ).not.toThrow();
  });

  it("still blocks other entities when approved", () => {
    expect(() =>
      assertContractEntityMutable({
        ...ctx("APPROVED"),
        entity: "agreementVersion",
      }),
    ).toThrow(ReadOnlyStageError);
  });
});

