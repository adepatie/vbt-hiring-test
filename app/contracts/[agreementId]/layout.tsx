import { CopilotParamsInjector } from "@/components/copilot/copilot-params-injector";

export default async function AgreementLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ agreementId: string }>;
}) {
  const { agreementId } = await params;
  return (
    <>
      <CopilotParamsInjector
        workflow="contracts"
        entityId={agreementId}
        entityType="agreement"
      />
      {children}
    </>
  );
}

