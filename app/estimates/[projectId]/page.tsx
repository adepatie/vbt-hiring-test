import { Container } from "@chakra-ui/react";
import { notFound } from "next/navigation";
import { estimatesService } from "@/lib/services/estimatesService";
import {
  ProjectDetailView,
  type ProjectDetailClient,
} from "./project-detail-view";

type EstimateDetailPageProps = {
  params: { projectId: string };
};

export default async function EstimateDetailPage({
  params,
}: EstimateDetailPageProps) {
  const project = await estimatesService
    .getProjectWithDetails(params.projectId)
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
    <Container maxW="6xl" py={{ base: 10, md: 16 }}>
      <ProjectDetailView
        key={`${serializableProject.id}-${serializableProject.stage}`}
        project={serializableProject}
      />
    </Container>
  );
}

