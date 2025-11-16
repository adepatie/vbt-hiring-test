type AgreementDetailPageProps = {
  params: Promise<{ agreementId: string }>;
};

export default async function AgreementDetailPage({
  params,
}: AgreementDetailPageProps) {
  const { agreementId } = await params;
  return (
    <main className="container max-w-5xl py-10 md:py-16 space-y-4">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Agreement detail
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Agreement #{agreementId}
        </h1>
        <p className="text-muted-foreground">
          Agreement version selector, policy alignment, and Copilot review UI will be
          scaffolded here.
        </p>
      </div>
    </main>
  );
}

