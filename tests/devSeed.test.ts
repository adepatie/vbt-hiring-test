import { File } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readFileMock,
  ingestArtifactFileMock,
  createProjectMock,
  getProjectWithDetailsMock,
  prismaMock,
} = vi.hoisted(() => {
  const readFileMock = vi.fn();
  const ingestArtifactFileMock = vi.fn();
  const createProjectMock = vi.fn();
  const getProjectWithDetailsMock = vi.fn();
  const prismaMock = {
    project: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
    artifact: { deleteMany: vi.fn() },
    businessCase: { deleteMany: vi.fn() },
    requirements: { deleteMany: vi.fn() },
    solutionArchitecture: { deleteMany: vi.fn() },
    quote: { deleteMany: vi.fn() },
    wBSItem: { deleteMany: vi.fn() },
    stageTransition: { deleteMany: vi.fn() },
  };

  return {
    readFileMock,
    ingestArtifactFileMock,
    createProjectMock,
    getProjectWithDetailsMock,
    prismaMock,
  };
});

vi.mock("node:fs/promises", () => ({
  default: { readFile: readFileMock },
  readFile: readFileMock,
}));

vi.mock("@/lib/server/artifact-ingest", () => ({
  ingestArtifactFile: ingestArtifactFileMock,
}));

vi.mock("@/lib/services/estimatesService", () => ({
  estimatesService: {
    createProject: createProjectMock,
    getProjectWithDetails: getProjectWithDetailsMock,
    listRoles: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/lib/db", () => ({
  default: prismaMock,
}));

import {
  DEV_SEED_DEFAULTS,
  SAMPLE_ARTIFACTS,
  seedDevProject,
} from "@/lib/server/dev-seed";

describe("seedDevProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.project.findFirst.mockResolvedValue(null);
    readFileMock.mockResolvedValue(Buffer.from("Sample artifact content"));
    createProjectMock.mockResolvedValue({
      id: "project-1",
      name: DEV_SEED_DEFAULTS.projectName,
      clientName: DEV_SEED_DEFAULTS.clientName,
      stage: "ARTIFACTS",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    getProjectWithDetailsMock.mockResolvedValue({
      id: "project-1",
      name: DEV_SEED_DEFAULTS.projectName,
      clientName: DEV_SEED_DEFAULTS.clientName,
      stage: "ARTIFACTS",
      artifacts: [],
      businessCase: null,
      requirements: null,
      solution: null,
      quote: null,
      wbsItems: [],
      stageTransitions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    let callIndex = 0;
    ingestArtifactFileMock.mockImplementation(async (input: any) => {
      const artifact = {
        id: `artifact-${callIndex}`,
        projectId: input.projectId,
        type: input.type,
        content: "Summary",
        url: null,
        originalName: input.file.name,
        storedFile: `${input.projectId}/${input.file.name}`,
        mimeType: "text/markdown",
        sizeBytes: 1,
        createdAt: new Date(),
      };
      callIndex += 1;
      return artifact;
    });
  });

  it("creates a project and ingests all sample artifacts as markdown files", async () => {
    const result = await seedDevProject({
      projectName: DEV_SEED_DEFAULTS.projectName,
      clientName: DEV_SEED_DEFAULTS.clientName,
      overwriteExisting: false,
      returnDetails: true,
    });

    expect(createProjectMock).toHaveBeenCalledWith({
      name: DEV_SEED_DEFAULTS.projectName,
      clientName: DEV_SEED_DEFAULTS.clientName,
    });
    expect(ingestArtifactFileMock).toHaveBeenCalledTimes(SAMPLE_ARTIFACTS.length);

    ingestArtifactFileMock.mock.calls.forEach((call, index) => {
      const args = call[0];
      expect(args.type).toBe(SAMPLE_ARTIFACTS[index].type);
      expect(args.file).toBeInstanceOf(File);
    });

    expect(result.projectId).toBe("project-1");
    expect(result.project?.id).toBe("project-1");
    expect(result.seededArtifacts).toHaveLength(SAMPLE_ARTIFACTS.length);
  });
});


