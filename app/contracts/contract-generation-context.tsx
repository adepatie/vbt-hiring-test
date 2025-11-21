"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { toast } from "sonner";
import { generateContractAction } from "./actions";
import { useRouter } from "next/navigation";

type GenerationOptions = {
  runAutoReview?: boolean;
};

type ContractGenerationContextType = {
  startGeneration: (
    agreementId: string,
    notes?: string,
    excludedPolicyIds?: string[],
    options?: GenerationOptions,
  ) => Promise<void>;
  isGenerating: (agreementId: string) => boolean;
};

const ContractGenerationContext = createContext<ContractGenerationContextType | undefined>(undefined);

export function ContractGenerationProvider({ children }: { children: ReactNode }) {
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  const startGeneration = async (
    agreementId: string,
    notes?: string,
    excludedPolicyIds?: string[],
    options?: GenerationOptions,
  ) => {
    // Add to generating set
    setGeneratingIds((prev) => new Set(prev).add(agreementId));

    const promise = generateContractAction(agreementId, notes, excludedPolicyIds, options);

    toast.promise(promise, {
      loading: "Generating contract draft...",
      success: (data) => {
        setGeneratingIds((prev) => {
          const next = new Set(prev);
          next.delete(agreementId);
          return next;
        });
        
        if (!data.success) {
            // If the action returned success: false, throw to trigger error toast
            throw new Error(data.error || "Generation failed");
        }
        
        router.refresh();
        return "Contract draft generated successfully";
      },
      error: (err) => {
        setGeneratingIds((prev) => {
          const next = new Set(prev);
          next.delete(agreementId);
          return next;
        });
        return err.message || "Failed to generate contract";
      },
    });
  };

  const isGenerating = (agreementId: string) => generatingIds.has(agreementId);

  return (
    <ContractGenerationContext.Provider value={{ startGeneration, isGenerating }}>
      {children}
    </ContractGenerationContext.Provider>
  );
}

export function useContractGeneration() {
  const context = useContext(ContractGenerationContext);
  if (context === undefined) {
    throw new Error("useContractGeneration must be used within a ContractGenerationProvider");
  }
  return context;
}

