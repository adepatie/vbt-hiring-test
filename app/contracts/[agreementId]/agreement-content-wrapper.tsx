"use client";

import { useContractGeneration } from "../contract-generation-context";
import { Loader2 } from "lucide-react";
import { ReactNode } from "react";

export function AgreementContentWrapper({ 
  agreementId, 
  children 
}: { 
  agreementId: string, 
  children: ReactNode 
}) {
  const { isGenerating } = useContractGeneration();
  const generating = isGenerating(agreementId);

  if (generating) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-12 w-12 animate-spin mb-4 text-primary" />
          <p className="mt-4 text-lg font-medium">Generating Draft</p>
          <p className="text-sm text-muted-foreground">This may take a few moments...</p>
        </div>
      );
  }

  return <>{children}</>;
}

