import { notFound, redirect } from "next/navigation";
import { estimatesService } from "@/lib/services/estimatesService";
import { isEstimateFlowComplete } from "@/lib/utils/estimates";
import { ProjectDetailView } from "./project-detail-view";
import {
  type ProjectDetailClient,
  serializeProjectDetail,
  type RoleOption,
} from "./project-types";

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

  if (!isEstimateFlowComplete(project.stage)) {
    redirect(`/estimates/${projectId}/flow`);
  }

  const serializableProject: ProjectDetailClient =
    serializeProjectDetail(project);
  const roles = await estimatesService.listRoles();
  const roleOptions: RoleOption[] = roles.map((role) => ({
    id: role.id,
    name: role.name,
    rate: role.rate,
  }));

  return (
    <main className="container py-10 md:py-16">
      <ProjectDetailView
        key={`${serializableProject.id}-${serializableProject.stage}`}
        project={serializableProject}
        roleOptions={roleOptions}
      />
    </main>
  );
}

