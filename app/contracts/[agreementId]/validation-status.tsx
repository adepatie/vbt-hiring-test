import { validateAgreementAgainstEstimate } from "@/lib/services/validationService";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { alignAgreementWithEstimateAction } from "../actions";

export default async function ValidationStatus({ agreementId }: { agreementId: string }) {
  const { valid, issues } = await validateAgreementAgainstEstimate(agreementId);

  if (valid) {
    return (
      <Alert className="bg-green-50/50 border-green-200 text-green-800 dark:bg-green-950/10 dark:border-green-900/50 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Estimate Aligned</AlertTitle>
        <AlertDescription>
          This agreement matches the cost and terms of the linked estimate.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" className="bg-amber-50/50 border-amber-200 text-amber-800 dark:bg-amber-950/10 dark:border-amber-900/50 dark:text-amber-400 [&>svg]:text-amber-800 dark:[&>svg]:text-amber-400">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Estimate Mismatch</AlertTitle>
      <AlertDescription className="space-y-3">
        <ul className="list-disc list-inside text-sm mt-1 space-y-1">
          {issues.map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>
        <form action={alignAgreementWithEstimateAction}>
          <input type="hidden" name="agreementId" value={agreementId} />
          <Button type="submit" variant="outline" size="sm">
            Align with Estimate
          </Button>
        </form>
      </AlertDescription>
    </Alert>
  );
}

