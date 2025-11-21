import { notFound, redirect } from "next/navigation";

import { estimatesService } from "@/lib/services/estimatesService";
import { isEstimateFlowComplete } from "@/lib/utils/estimates";
import { ProjectFlowView } from "../project-flow-view";
import {
  type ProjectDetailClient,
  serializeProjectDetail,
  type RoleOption,
} from "../project-types";

type EstimateFlowPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function EstimateFlowPage({
  params,
}: EstimateFlowPageProps) {
  const { projectId } = await params;
  const project = await estimatesService
    .getProjectWithDetails(projectId)
    .catch(() => null);

  if (!project) {
    notFound();
  }

  if (isEstimateFlowComplete(project.stage)) {
    redirect(`/estimates/${projectId}`);
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
    <ProjectFlowView project={serializableProject} roleOptions={roleOptions} />
  );
}

