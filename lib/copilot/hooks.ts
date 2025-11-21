"use client";

import { useState, useCallback } from "react";

export interface CopilotActionOptions<TResult = any> {
  onSuccess?: (result: TResult) => void;
  onError?: (error: Error) => void;
}

export function useCopilotAction<TInput = any, TResult = any>(
  actionName: string,
  options?: CopilotActionOptions<TResult>,
) {
  const [isLoading, setIsLoading] = useState(false);

  const run = useCallback(
    async (input: TInput) => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/copilot", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: actionName,
            payload: input,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Copilot action failed");
        }

        if (options?.onSuccess) {
          options.onSuccess(data.result);
        }
        return data.result;
      } catch (error) {
        console.error("Copilot action error:", error);
        const err = error instanceof Error ? error : new Error(String(error));
        if (options?.onError) {
          options.onError(err);
        }
        // We re-throw so the caller can also catch if they await run()
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [actionName, options],
  );

  return { run, isLoading };
}

