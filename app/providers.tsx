"use client";

import { ChakraProvider } from "@chakra-ui/react";
import { ReactNode } from "react";

import theme from "@/lib/theme";
import { AppToaster } from "@/lib/ui/toaster";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <ChakraProvider value={theme}>
      {children}
      <AppToaster />
    </ChakraProvider>
  );
}

export default Providers;

