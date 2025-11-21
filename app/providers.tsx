"use client";

import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { AppToaster } from "@/lib/ui/toaster";
import { ContractGenerationProvider } from "@/app/contracts/contract-generation-context";
import { CopilotProvider } from "@/components/copilot/copilot-context";
import { CopilotShell } from "@/components/copilot/copilot-shell";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <CopilotProvider>
        <CopilotShell>
      <ContractGenerationProvider>
        {children}
      </ContractGenerationProvider>
        </CopilotShell>
      </CopilotProvider>
      <AppToaster />
    </ThemeProvider>
  );
}

export default Providers;

