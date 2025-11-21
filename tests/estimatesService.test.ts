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
  roleId: string | null;
  roleName: string | null;
  hours: number;
};

type NarrativeRecord = {
  id: string;
  projectId: string;
  content: string;
  approved: boolean;
};

type RoleRecord = {
  id: string;
  name: string;
  rate: number;
  createdAt: Date;
  updatedAt: Date;
};

type ArtifactRecord = {
  id: string;
  projectId: string;
  type: string;
  content: string | null;
  url: string | null;
  originalName: string | null;
  storedFile: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: Date;
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
type ProjectFindFirstArgs = {
  orderBy?: { updatedAt?: "asc" | "desc" };
  select?: Record<string, boolean>;
};
type StageTransitionCreateArgs = {
  data: { projectId: string; from: string; to: string };
};
type WbsFindManyArgs = {
  where?: { projectId?: string };
  select?: { id?: boolean };
  include?: { role?: boolean };
  orderBy?: { task?: "asc" | "desc" };
};
type WbsDeleteManyArgs = {
  where: { projectId: string; id?: { notIn?: string[]; in?: string[] } };
};
type WbsUpdateArgs = { where: { id: string }; data: Partial<WbsRecord> };
type WbsCreateArgs = { data: Omit<WbsRecord, "id"> };
type ArtifactCreateArgs = { data: Omit<ArtifactRecord, "id" | "createdAt"> };
type ArtifactFindUniqueArgs = { where: { id: string } };
type ArtifactDeleteArgs = { where: { id: string } };
type ArtifactCountArgs = {
  where?: {
    projectId?: string;
    storedFile?: { not?: null };
    OR?: Array<{ storedFile?: { not?: null }; content?: { not?: null } }>;
  };
};
type PrismaTransactionInput =
  | Array<Promise<unknown>>
  | ((tx: PrismaClientMock) => Promise<unknown>);
type PrismaClientMock = {
  project: {
    findUnique: (args: ProjectFindUniqueArgs) => Promise<ProjectRecord | null>;
    update: (args: ProjectUpdateArgs) => Promise<ProjectRecord | null>;
    findFirst: (
      args?: ProjectFindFirstArgs,
    ) => Promise<ProjectRecord | Record<string, unknown> | null>;
    count: () => Promise<number>;
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
  artifact: {
    create: (args: ArtifactCreateArgs) => Promise<ArtifactRecord>;
    findUnique: (args: ArtifactFindUniqueArgs) => Promise<ArtifactRecord | null>;
    delete: (args: ArtifactDeleteArgs) => Promise<ArtifactRecord>;
    count: (args?: ArtifactCountArgs) => Promise<number>;
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

  const DEFAULT_TEST_ROLES = [
    { id: "role_delivery_lead", name: "Delivery Lead", rate: 225 },
    { id: "role_project_manager", name: "Project Manager", rate: 180 },
    { id: "role_senior_engineer", name: "Senior Engineer", rate: 165 },
    { id: "role_designer", name: "Product Designer", rate: 140 },
    { id: "role_quality_engineer", name: "QA Engineer", rate: 120 },
  ] as const;

  const state = {
    projects: new Map<string, ProjectRecord>(),
    wbsItems: new Map<string, WbsRecord>(),
    artifacts: new Map<string, ArtifactRecord>(),
    transitions: [] as StageTransitionRecord[],
    roles: new Map<string, RoleRecord>(),
    businessCases: new Map<string, NarrativeRecord>(),
    requirements: new Map<string, NarrativeRecord>(),
    solutions: new Map<string, NarrativeRecord>(),
  };

  let wbsCounter = 1;
  let artifactCounter = 1;
  let transitionCounter = 1;
  let narrativeCounter = 1;

  const makeCuid = (prefix: string, counter: number) =>
    `c${prefix}${counter.toString().padStart(20, "0")}`;

  const reset = () => {
    state.projects.clear();
    state.wbsItems.clear();
    state.artifacts.clear();
    state.transitions = [];
    state.roles.clear();
    state.businessCases.clear();
    state.requirements.clear();
    state.solutions.clear();
    wbsCounter = 1;
    artifactCounter = 1;
    narrativeCounter = 1;
    state.projects.set(PROJECT_ID, createProject());
    for (const role of DEFAULT_TEST_ROLES) {
      state.roles.set(role.id, {
        id: role.id,
        name: role.name,
        rate: role.rate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
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
      findFirst: async (args: ProjectFindFirstArgs = {}) => {
        let projects = Array.from(state.projects.values());
        if (args.orderBy?.updatedAt) {
          const direction = args.orderBy.updatedAt === "asc" ? 1 : -1;
          projects = projects.sort(
            (a, b) =>
              direction * (a.updatedAt.getTime() - b.updatedAt.getTime()),
          );
        }
        const record = projects[0];
        if (!record) {
          return null;
        }
        if (!args.select) {
          return record;
        }
        const selected: Record<string, unknown> = {};
        for (const [key, include] of Object.entries(args.select)) {
          if (include && key in record) {
            selected[key] = (record as Record<string, unknown>)[key];
          }
        }
        return selected;
      },
      count: async () => state.projects.size,
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
    businessCase: {
      upsert: async ({ where, update, create }: any) => {
        const existing = state.businessCases.get(where.projectId);
        const payload = existing
          ? { ...existing, ...update }
          : {
              id: makeCuid("bc", narrativeCounter++),
              projectId: where.projectId,
              content: create.content,
              approved: create.approved ?? false,
            };
        state.businessCases.set(where.projectId, payload);
        return payload;
      },
    },
    requirements: {
      upsert: async ({ where, update, create }: any) => {
        const existing = state.requirements.get(where.projectId);
        const payload = existing
          ? { ...existing, ...update }
          : {
              id: makeCuid("req", narrativeCounter++),
              projectId: where.projectId,
              content: create.content,
              approved: create.approved ?? false,
            };
        state.requirements.set(where.projectId, payload);
        return payload;
      },
    },
    solutionArchitecture: {
      upsert: async ({ where, update, create }: any) => {
        const existing = state.solutions.get(where.projectId);
        const payload = existing
          ? { ...existing, ...update }
          : {
              id: makeCuid("sol", narrativeCounter++),
              projectId: where.projectId,
              content: create.content,
              approved: create.approved ?? false,
            };
        state.solutions.set(where.projectId, payload);
        return payload;
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
        if (args.include?.role) {
          return items.map((item) => ({
            ...item,
            role: item.roleId ? state.roles.get(item.roleId) ?? null : null,
          }));
        }
        return items;
      },
      deleteMany: async ({ where }: WbsDeleteManyArgs) => {
        const notIn: string[] = where.id?.notIn ?? [];
        const inIds: string[] | undefined = where.id?.in;
        for (const [key, item] of state.wbsItems.entries()) {
          if (item.projectId === where.projectId) {
            if (inIds?.length) {
              if (inIds.includes(item.id)) {
                state.wbsItems.delete(key);
              }
            } else if (notIn.length === 0 || !notIn.includes(item.id)) {
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
    artifact: {
      create: async ({ data }: ArtifactCreateArgs) => {
        const record: ArtifactRecord = {
          id: makeCuid("artifact", artifactCounter++),
          createdAt: new Date(),
          ...data,
          content: data.content ?? null,
          url: data.url ?? null,
          originalName: data.originalName ?? null,
          storedFile: data.storedFile ?? null,
          mimeType: data.mimeType ?? null,
          sizeBytes: data.sizeBytes ?? null,
        };
        state.artifacts.set(record.id, record);
        return record;
      },
      findUnique: async ({ where: { id } }: ArtifactFindUniqueArgs) =>
        state.artifacts.get(id) ?? null,
      delete: async ({ where: { id } }: ArtifactDeleteArgs) => {
        const existing = state.artifacts.get(id);
        if (!existing) {
          throw new Error("Artifact not found.");
        }
        state.artifacts.delete(id);
        return existing;
      },
      count: async (args: ArtifactCountArgs = {}) => {
        let items = Array.from(state.artifacts.values());
        if (args.where?.projectId) {
          items = items.filter(
            (artifact) => artifact.projectId === args.where?.projectId,
          );
        }
        if (args.where?.OR) {
          items = items.filter((artifact) =>
            args.where!.OR!.some((condition) => {
              if (condition.storedFile?.not === null) {
                return artifact.storedFile !== null;
              }
              if (condition.content?.not === null) {
                return artifact.content !== null;
              }
              return false;
            }),
          );
        } else if (args.where?.storedFile?.not === null) {
          items = items.filter((artifact) => artifact.storedFile !== null);
        }
        return items.length;
      },
    },
    role: {
      findMany: async (args?: {
        where?: { id?: { in?: string[] } };
        orderBy?: Array<{ rate?: "asc" | "desc"; name?: "asc" | "desc" }>;
      }) => {
        let items = Array.from(state.roles.values());
        const ids = args?.where?.id?.in;
        if (ids?.length) {
          const idSet = new Set(ids);
          items = items.filter((role) => idSet.has(role.id));
        }
        return items;
      },
      findUnique: async ({
        where,
      }: {
        where: { id?: string; name?: string };
      }) => {
        if (where.id) {
          return state.roles.get(where.id) ?? null;
        }
        if (where.name) {
          const match = Array.from(state.roles.values()).find(
            (role) => role.name === where.name,
          );
          return match ?? null;
        }
        return null;
      },
      create: async ({ data }: { data: { name: string; rate: number } }) => {
        const record: RoleRecord = {
          id: makeCuid("role", Date.now()),
          name: data.name,
          rate: Number(data.rate),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.roles.set(record.id, record);
        return record;
      },
      update: async ({
        where: { id },
        data,
      }: {
        where: { id: string };
        data: { name?: string; rate?: number };
      }) => {
        const existing = state.roles.get(id);
        if (!existing) {
          throw new Error("Role not found.");
        }
        const updated = {
          ...existing,
          name: data.name ?? existing.name,
          rate:
            data.rate !== undefined
              ? Number(data.rate)
              : existing.rate,
          updatedAt: new Date(),
        };
        state.roles.set(id, updated);
        return updated;
      },
      count: async () => state.roles.size,
      upsert: async ({
        where: { id },
        update,
        create,
      }: {
        where: { id: string };
        update: { name?: string; rate?: number };
        create: { id?: string; name: string; rate: number };
      }) => {
        const existing = state.roles.get(id);
        if (existing) {
          const updated = {
            ...existing,
            name: update.name ?? existing.name,
            rate:
              update.rate !== undefined
                ? Number(update.rate)
                : existing.rate,
            updatedAt: new Date(),
          };
          state.roles.set(id, updated);
          return updated;
        }
        const record: RoleRecord = {
          id: create.id ?? id ?? makeCuid("role", Date.now()),
          name: create.name,
          rate: Number(create.rate),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.roles.set(record.id, record);
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
      artifacts: Map<string, ArtifactRecord>;
      transitions: StageTransitionRecord[];
    };
  };
};

const mockPrisma = prisma as MockedPrisma;

beforeEach(() => {
  mockPrisma.__mock.reset();
});

describe("estimatesService.advanceStage", () => {
  const createFileArtifact = async (label: string) => {
    await estimatesService.addArtifact({
      projectId: PROJECT_ID,
      type: label,
      content: null,
      url: null,
      storedFile: `${PROJECT_ID}/${label.replace(/\s+/g, "-")}.pdf`,
      originalName: `${label}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });
  };

  it("advances to the next sequential stage and records a transition", async () => {
    await createFileArtifact("Artifact 1");
    await createFileArtifact("Artifact 2");
    const result = await estimatesService.advanceStage(PROJECT_ID, "BUSINESS_CASE");

    expect(result.stage).toBe("BUSINESS_CASE");
    expect(mockPrisma.__mock.state.projects.get(PROJECT_ID)?.stage).toBe(
      "BUSINESS_CASE",
    );
    expect(mockPrisma.__mock.state.transitions).toHaveLength(1);
    expect(mockPrisma.__mock.state.transitions[0].to).toBe("BUSINESS_CASE");
  });

  it("rejects non-sequential transitions", async () => {
    await createFileArtifact("Artifact 1");
    await createFileArtifact("Artifact 2");
    await expect(
      estimatesService.advanceStage(PROJECT_ID, "REQUIREMENTS"),
    ).rejects.toThrow("Cannot transition");
  });

  it("requires at least two uploaded artifacts before advancing past artifacts", async () => {
    await createFileArtifact("Only Artifact");

    await expect(
      estimatesService.advanceStage(PROJECT_ID, "BUSINESS_CASE"),
    ).rejects.toThrow("Upload at least two artifact files");
  });

  it("allows advancing with seeded artifacts (content but no stored file)", async () => {
    // Create seeded-style artifacts
    await estimatesService.addArtifact({
      projectId: PROJECT_ID,
      type: "Seeded Artifact 1",
      content: "Some content",
      url: null,
      storedFile: null,
      originalName: "seeded1.md",
      mimeType: "text/markdown",
      sizeBytes: 100,
    });
    await estimatesService.addArtifact({
      projectId: PROJECT_ID,
      type: "Seeded Artifact 2",
      content: "Some content",
      url: null,
      storedFile: null,
      originalName: "seeded2.md",
      mimeType: "text/markdown",
      sizeBytes: 100,
    });

    const result = await estimatesService.advanceStage(PROJECT_ID, "BUSINESS_CASE");
    expect(result.stage).toBe("BUSINESS_CASE");
  });
});

describe("estimatesService.addArtifact", () => {
  it("persists provided content and file metadata", async () => {
    const summaryText =
      "AI-generated summary of uploaded artifact 'Discovery Notes'";

    const artifact = await estimatesService.addArtifact({
      projectId: PROJECT_ID,
      type: "Discovery Notes",
      content: summaryText,
      url: null,
      storedFile: `${PROJECT_ID}/discovery-notes.md`,
      originalName: "discovery-notes.md",
      mimeType: "text/markdown",
      sizeBytes: 2048,
    });

    expect(artifact.content).toBe(summaryText);
    expect(artifact.storedFile).toContain("discovery-notes");
    expect(artifact.mimeType).toBe("text/markdown");
  });
});

describe("estimatesService.updateWbsItems", () => {
  it("creates, updates, and prunes WBS items", async () => {
    const roles = await estimatesService.listRoles();
    const primaryRole = roles[0];
    const secondaryRole = roles[1] ?? roles[0];
    mockPrisma.__mock.state.projects.get(PROJECT_ID)!.stage = "EFFORT";

    const initial = await estimatesService.updateWbsItems(PROJECT_ID, [
      { task: "Discovery", roleId: primaryRole.id, hours: 12 },
    ]);

    expect(initial).toHaveLength(1);
    const existingId = initial[0].id;

    const updated = await estimatesService.updateWbsItems(PROJECT_ID, [
      {
        id: existingId,
        task: "Discovery + Research",
        roleId: primaryRole.id,
        hours: 14,
      },
      { task: "Build", roleId: secondaryRole.id, hours: 40 },
    ]);

    expect(updated).toHaveLength(2);

    const updatedExisting = updated.find((item) => item.id === existingId);
    expect(updatedExisting?.hours).toBe(14);
    expect(updatedExisting?.task).toContain("Research");
    expect(updatedExisting?.roleName).toBe(primaryRole.name);

    expect(
      mockPrisma.__mock.state.wbsItems.has(existingId),
    ).toBeTruthy();
  });
});

describe("estimatesService.updateWbsItemsWithRoles", () => {
  it("allows referencing an existing role without specifying roleRate", async () => {
    const roles = await estimatesService.listRoles();
    const primaryRole = roles[0];
    mockPrisma.__mock.state.projects.get(PROJECT_ID)!.stage = "EFFORT";

    const items = await estimatesService.updateWbsItemsWithRoles({
      projectId: PROJECT_ID,
      items: [
        {
          task: "Scoping",
          hours: 10,
          roleName: primaryRole.name,
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0].roleName).toBe(primaryRole.name);
  });

  it("requires roleRate when creating a brand new role", async () => {
    mockPrisma.__mock.state.projects.get(PROJECT_ID)!.stage = "EFFORT";

    await expect(
      estimatesService.updateWbsItemsWithRoles({
        projectId: PROJECT_ID,
        items: [
          {
            task: "New Role Task",
            hours: 6,
            roleName: "Brand New Role",
          },
        ],
      }),
    ).rejects.toThrow("roleRate");
  });
});

describe("estimatesService.upsertWbsItemsWithRoles", () => {
  it("adds new rows without removing existing ones", async () => {
    const roles = await estimatesService.listRoles();
    mockPrisma.__mock.state.projects.get(PROJECT_ID)!.stage = "EFFORT";

    const initial = await estimatesService.updateWbsItems(PROJECT_ID, [
      { task: "Discovery", roleId: roles[0].id, hours: 12 },
    ]);

    expect(initial).toHaveLength(1);

    const updated = await estimatesService.upsertWbsItemsWithRoles({
      projectId: PROJECT_ID,
      items: [
        {
          task: "QA Sweep",
          hours: 8,
          roleName: roles[1]?.name ?? roles[0].name,
        },
      ],
    });

    expect(updated).toHaveLength(2);
    expect(updated.some((item) => item.task === "Discovery")).toBe(true);
    expect(updated.some((item) => item.task === "QA Sweep")).toBe(true);
  });

  it("updates an existing row when id is provided", async () => {
    const roles = await estimatesService.listRoles();
    mockPrisma.__mock.state.projects.get(PROJECT_ID)!.stage = "EFFORT";

    const seeded = await estimatesService.updateWbsItems(PROJECT_ID, [
      { task: "Architecture", roleId: roles[0].id, hours: 20 },
    ]);

    const existingId = seeded[0].id;

    const result = await estimatesService.upsertWbsItemsWithRoles({
      projectId: PROJECT_ID,
      items: [
        {
          id: existingId,
          task: "Architecture Review",
          hours: 22,
          roleName: roles[0].name,
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(existingId);
    expect(result[0].hours).toBe(22);
    expect(result[0].task).toBe("Architecture Review");
  });
});

describe("estimatesService.removeWbsItems", () => {
  it("removes only the specified rows", async () => {
    const roles = await estimatesService.listRoles();
    mockPrisma.__mock.state.projects.get(PROJECT_ID)!.stage = "EFFORT";

    const seeded = await estimatesService.updateWbsItems(PROJECT_ID, [
      { task: "Task A", roleId: roles[0].id, hours: 5 },
      { task: "Task B", roleId: roles[1]?.id ?? roles[0].id, hours: 10 },
    ]);

    const removeId = seeded[0].id;

    const remaining = await estimatesService.removeWbsItems({
      projectId: PROJECT_ID,
      itemIds: [removeId],
    });

    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).not.toBe(removeId);
    expect(remaining[0].task).toBe("Task B");
  });
});

describe("estimate mutation guardrails", () => {
  it("allows adding artifacts even after leaving the artifacts stage", async () => {
    mockPrisma.__mock.state.projects.get(PROJECT_ID)!.stage = "BUSINESS_CASE";

    await expect(
      estimatesService.addArtifact({
        projectId: PROJECT_ID,
        type: "Late Artifact",
        content: "content",
        url: null,
        storedFile: null,
        originalName: null,
        mimeType: null,
        sizeBytes: null,
      }),
    ).resolves.toMatchObject({ type: "Late Artifact" });
  });

  it("blocks deleting every WBS item without explicit confirmation", async () => {
    const roles = await estimatesService.listRoles();
    const primaryRole = roles[0];
    mockPrisma.__mock.state.projects.get(PROJECT_ID)!.stage = "EFFORT";

    await estimatesService.updateWbsItems(PROJECT_ID, [
      { task: "Initial Task", roleId: primaryRole.id, hours: 10 },
    ]);

    await expect(
      estimatesService.updateWbsItems(PROJECT_ID, []),
    ).rejects.toThrow("Refusing to delete");

    const cleared = await estimatesService.updateWbsItems(
      PROJECT_ID,
      [],
      { allowMassDelete: true },
    );

    expect(cleared).toEqual([]);
  });

  it("allows editing earlier stages even after the project moves forward", async () => {
    mockPrisma.__mock.state.projects.get(PROJECT_ID)!.stage = "SOLUTION";

    await expect(
      estimatesService.saveStageContent({
        projectId: PROJECT_ID,
        stage: "BUSINESS_CASE",
        content: "Updated business case",
      }),
    ).resolves.toMatchObject({ content: "Updated business case" });
  });
});

describe("estimatesService.getDashboardStats", () => {
  it("returns the project count and most recent update timestamp", async () => {
    const newestTimestamp = new Date("2024-02-01T12:34:00.000Z");
    const baseline = mockPrisma.__mock.state.projects.get(PROJECT_ID)!;
    baseline.updatedAt = new Date("2024-01-15T08:00:00.000Z");

    const secondProjectId = "ckproj00000000000000000001";
    mockPrisma.__mock.state.projects.set(secondProjectId, {
      id: secondProjectId,
      name: "Second Project",
      clientName: "ACME Corp",
      stage: "ARTIFACTS",
      createdAt: new Date("2024-01-20T00:00:00.000Z"),
      updatedAt: newestTimestamp,
    });

    const stats = await estimatesService.getDashboardStats();

    expect(stats.count).toBe(2);
    expect(stats.lastUpdated?.toISOString()).toBe(newestTimestamp.toISOString());
  });
});


