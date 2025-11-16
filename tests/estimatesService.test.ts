import { beforeEach, describe, expect, it, vi } from "vitest";

const PROJECT_ID = vi.hoisted(() => "ckproj00000000000000000000");

type ProjectRecord = {
  id: string;
  name: string;
  clientName: string | null;
  stage: string;
  createdAt: Date;
  updatedAt: Date;
};

type WbsRecord = {
  id: string;
  projectId: string;
  task: string;
  role: string;
  hours: number;
};

type StageTransitionRecord = {
  id: string;
  projectId: string;
  from: string;
  to: string;
  timestamp: Date;
};

type ProjectFindUniqueArgs = { where: { id: string } };
type ProjectUpdateArgs = { where: { id: string }; data: Partial<ProjectRecord> };
type StageTransitionCreateArgs = {
  data: { projectId: string; from: string; to: string };
};
type WbsFindManyArgs = {
  where?: { projectId?: string };
  select?: { id?: boolean };
  orderBy?: { task?: "asc" | "desc" };
};
type WbsDeleteManyArgs = {
  where: { projectId: string; id?: { notIn?: string[] } };
};
type WbsUpdateArgs = { where: { id: string }; data: Partial<WbsRecord> };
type WbsCreateArgs = { data: Omit<WbsRecord, "id"> };
type PrismaTransactionInput =
  | Array<Promise<unknown>>
  | ((tx: PrismaClientMock) => Promise<unknown>);
type PrismaClientMock = {
  project: {
    findUnique: (args: ProjectFindUniqueArgs) => Promise<ProjectRecord | null>;
    update: (args: ProjectUpdateArgs) => Promise<ProjectRecord | null>;
  };
  stageTransition: {
    create: (args: StageTransitionCreateArgs) => Promise<StageTransitionRecord>;
  };
  wBSItem: {
    findMany: (
      args?: WbsFindManyArgs,
    ) => Promise<Array<{ id: string } | WbsRecord>>;
    deleteMany: (args: WbsDeleteManyArgs) => Promise<{ count: number }>;
    update: (args: WbsUpdateArgs) => Promise<WbsRecord>;
    create: (args: WbsCreateArgs) => Promise<WbsRecord>;
  };
  $transaction: (operations: PrismaTransactionInput) => Promise<unknown>;
};

vi.mock("@/lib/db", () => {

  const createProject = (): ProjectRecord => ({
    id: PROJECT_ID,
    name: "Mock Project",
    clientName: null,
    stage: "ARTIFACTS",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  });

  const state = {
    projects: new Map<string, ProjectRecord>(),
    wbsItems: new Map<string, WbsRecord>(),
    transitions: [] as StageTransitionRecord[],
  };

  let wbsCounter = 1;
  let transitionCounter = 1;

  const makeCuid = (prefix: string, counter: number) =>
    `c${prefix}${counter.toString().padStart(20, "0")}`;

  const reset = () => {
    state.projects.clear();
    state.wbsItems.clear();
    state.transitions = [];
    wbsCounter = 1;
    state.projects.set(PROJECT_ID, createProject());
  };

  reset();

  const prisma: PrismaClientMock & {
    __mock: { reset: () => void; state: typeof state };
  } = {
    project: {
      findUnique: async ({ where: { id } }: ProjectFindUniqueArgs) =>
        state.projects.get(id) ?? null,
      update: async ({ where: { id }, data }: ProjectUpdateArgs) => {
        const existing = state.projects.get(id);
        if (!existing) {
          return null;
        }
        const updated = {
          ...existing,
          ...data,
          updatedAt: new Date(),
        };
        state.projects.set(id, updated);
        return updated;
      },
    },
    stageTransition: {
      create: async ({ data }: StageTransitionCreateArgs) => {
        const record = {
          id: makeCuid("transition", transitionCounter++),
          ...data,
          timestamp: new Date(),
        };
        state.transitions.push(record);
        return record;
      },
    },
    wBSItem: {
      findMany: async (args: WbsFindManyArgs = {}) => {
        const projectId = args.where?.projectId;
        let items = Array.from(state.wbsItems.values()).filter((item) =>
          projectId ? item.projectId === projectId : true,
        );
        if (args.select?.id) {
          return items.map((item) => ({ id: item.id }));
        }
        if (args.orderBy?.task) {
          items = items.sort((a, b) => a.task.localeCompare(b.task));
        }
        return items;
      },
      deleteMany: async ({ where }: WbsDeleteManyArgs) => {
        const notIn: string[] = where.id?.notIn ?? [];
        for (const [key, item] of state.wbsItems.entries()) {
          if (item.projectId === where.projectId) {
            if (notIn.length === 0 || !notIn.includes(item.id)) {
              state.wbsItems.delete(key);
            }
          }
        }
        return { count: 0 };
      },
      update: async ({ where: { id }, data }: WbsUpdateArgs) => {
        const existing = state.wbsItems.get(id);
        if (!existing) {
          throw new Error("WBS item not found.");
        }
        const updated = {
          ...existing,
          ...data,
        };
        state.wbsItems.set(id, updated);
        return updated;
      },
      create: async ({ data }: WbsCreateArgs) => {
        const record = {
          id: makeCuid("wbs", wbsCounter++),
          ...data,
        };
        state.wbsItems.set(record.id, record);
        return record;
      },
    },
    $transaction: async (operations: PrismaTransactionInput) => {
      if (typeof operations === "function") {
        return operations(prisma);
      }
      return Promise.all(operations);
    },
    __mock: {
      reset,
      state,
    },
  };

  return {
    __esModule: true,
    default: prisma,
    prisma,
  };
});

import prisma from "@/lib/db";
import { estimatesService } from "@/lib/services/estimatesService";

type MockedPrisma = typeof prisma & {
  __mock: {
    reset: () => void;
    state: {
      projects: Map<string, ProjectRecord>;
      wbsItems: Map<string, WbsRecord>;
      transitions: StageTransitionRecord[];
    };
  };
};

const mockPrisma = prisma as MockedPrisma;

beforeEach(() => {
  mockPrisma.__mock.reset();
});

describe("estimatesService.advanceStage", () => {
  it("advances to the next sequential stage and records a transition", async () => {
    const result = await estimatesService.advanceStage(PROJECT_ID, "BUSINESS_CASE");

    expect(result.stage).toBe("BUSINESS_CASE");
    expect(mockPrisma.__mock.state.projects.get(PROJECT_ID)?.stage).toBe(
      "BUSINESS_CASE",
    );
    expect(mockPrisma.__mock.state.transitions).toHaveLength(1);
    expect(mockPrisma.__mock.state.transitions[0].to).toBe("BUSINESS_CASE");
  });

  it("rejects non-sequential transitions", async () => {
    await expect(
      estimatesService.advanceStage(PROJECT_ID, "REQUIREMENTS"),
    ).rejects.toThrow("Cannot transition");
  });
});

describe("estimatesService.updateWbsItems", () => {
  it("creates, updates, and prunes WBS items", async () => {
    const initial = await estimatesService.updateWbsItems(PROJECT_ID, [
      { task: "Discovery", role: "PM", hours: 12 },
    ]);

    expect(initial).toHaveLength(1);
    const existingId = initial[0].id;

    const updated = await estimatesService.updateWbsItems(PROJECT_ID, [
      { id: existingId, task: "Discovery + Research", role: "PM", hours: 14 },
      { task: "Build", role: "ENG", hours: 40 },
    ]);

    expect(updated).toHaveLength(2);

    const updatedExisting = updated.find((item) => item.id === existingId);
    expect(updatedExisting?.hours).toBe(14);
    expect(updatedExisting?.task).toContain("Research");

    expect(
      mockPrisma.__mock.state.wbsItems.has(existingId),
    ).toBeTruthy();
  });
});


