"use client";

import {
  HStack,
  Stack,
  ToastCloseTrigger,
  ToastDescription,
  ToastIndicator,
  ToastRoot,
  ToastTitle,
  Toaster,
  createToaster,
} from "@chakra-ui/react";

export const appToaster = createToaster({
  placement: "top-end",
  gap: 16,
});

export function AppToaster() {
  return (
    <Toaster toaster={appToaster} gap="4" zIndex="toast">
      {(toast) => (
        <ToastRoot
          type={toast.type}
          borderRadius="lg"
          boxShadow="lg"
          bg="white"
          color="gray.900"
          px={4}
          py={3}
          minW={{ base: "auto", sm: "320px" }}
        >
          <HStack align="flex-start" spacing={3}>
            <ToastIndicator />
            <Stack spacing={1} flex="1">
              {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
              {toast.description && (
                <ToastDescription>{toast.description}</ToastDescription>
              )}
            </Stack>
            <ToastCloseTrigger />
          </HStack>
        </ToastRoot>
      )}
    </Toaster>
  );
}


