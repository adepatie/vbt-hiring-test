import { estimatesService } from "@/lib/services/estimatesService";
import { ProjectList, type ProjectListProject } from "./project-list";

export default async function EstimatesPage() {
  const projects = await estimatesService.listProjects();

  const serializableProjects: ProjectListProject[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    clientName: project.clientName ?? null,
    stage: project.stage,
    updatedAt: project.updatedAt.toISOString(),
  }));

  return (
    <main className="container max-w-6xl py-10 md:py-16 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Estimates</h1>
        <p className="text-muted-foreground">
          Track every project estimate, manage stage progress, and capture new work in one place.
        </p>
      </div>
      <ProjectList projects={serializableProjects} />
    </main>
  );
}

