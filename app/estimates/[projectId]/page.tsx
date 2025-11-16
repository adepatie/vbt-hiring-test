import { notFound } from "next/navigation";
import { estimatesService } from "@/lib/services/estimatesService";
import {
  ProjectDetailView,
  type ProjectDetailClient,
} from "./project-detail-view";

type EstimateDetailPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function EstimateDetailPage({
  params,
}: EstimateDetailPageProps) {
  const { projectId } = await params;
  const project = await estimatesService
    .getProjectWithDetails(projectId)
    .catch(() => null);

  if (!project) {
    notFound();
  }

  const serializableProject: ProjectDetailClient = {
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
  };

  return (
    <main className="container max-w-6xl py-10 md:py-16">
      <ProjectDetailView
        key={`${serializableProject.id}-${serializableProject.stage}`}
        project={serializableProject}
      />
    </main>
  );
}

