"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

type ToastPayload = {
  title: string;
  description?: string;
};

export const appToaster = {
  success({ title, description }: ToastPayload) {
    toast.success(title, { description });
  },
  error({ title, description }: ToastPayload) {
    toast.error(title, { description });
  },
};

export function AppToaster() {
  return (
    <SonnerToaster
      richColors
      position="top-right"
      toastOptions={{
        classNames: {
          toast: "bg-background text-foreground shadow-lg border",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}


