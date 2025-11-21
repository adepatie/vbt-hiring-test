import { CopilotParamsInjector } from "@/components/copilot/copilot-params-injector";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <>
      <CopilotParamsInjector
        workflow="estimates"
        entityId={projectId}
        entityType="project"
      />
      {children}
    </>
  );
}

