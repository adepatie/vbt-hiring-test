import type {
  Artifact,
  ProjectDetail,
  StageTransition,
} from "@/lib/zod/estimates";

export type SerializableArtifact = Omit<Artifact, "createdAt"> & {
  createdAt: string;
};

export type SerializableStageTransition = Omit<
  StageTransition,
  "timestamp"
> & {
  timestamp: string;
};

export type ProjectDetailClient = Omit<
  ProjectDetail,
  "createdAt" | "updatedAt" | "artifacts" | "stageTransitions" | "clientName"
> & {
  clientName: string | null;
  createdAt: string;
  updatedAt: string;
  artifacts: SerializableArtifact[];
  stageTransitions: SerializableStageTransition[];
};

export const serializeProjectDetail = (
  project: ProjectDetail,
): ProjectDetailClient => ({
  ...project,
  clientName: project.clientName ?? null,
  createdAt: project.createdAt.toISOString(),
  updatedAt: project.updatedAt.toISOString(),
  artifacts: project.artifacts.map((artifact) => ({
    ...artifact,
    createdAt: artifact.createdAt.toISOString(),
  })),
  stageTransitions: project.stageTransitions.map((transition) => ({
    ...transition,
    timestamp: transition.timestamp.toISOString(),
  })),
});

export type RoleOption = {
  id: string;
  name: string;
  rate: number;
};

