import { useEffect, type DependencyList, type ReactNode } from "react";
import { useActionBar } from "@/components/copilot/copilot-context";

export function useStageActions(
  factory: () => ReactNode,
  deps: DependencyList,
) {
  const { setActions } = useActionBar();

  // Cleanup on unmount
  useEffect(() => {
    return () => setActions(null);
  }, [setActions]);

  // Update actions when dependencies change
  useEffect(() => {
    setActions(factory());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActions, ...deps]);
}

