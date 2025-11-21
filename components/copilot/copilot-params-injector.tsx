"use client";

import { useEffect } from "react";
import { useCopilot } from "./copilot-context";

export function CopilotParamsInjector({
  workflow,
  entityId,
  view,
  entityType,
}: {
  workflow: "estimates" | "contracts";
  entityId: string;
  view?: string;
  entityType?: "project" | "agreement";
}) {
  const { setPageContext } = useCopilot();

  useEffect(() => {
    setPageContext({ workflow, entityId, view, entityType });
  }, [workflow, entityId, view, entityType, setPageContext]);

  return null;
}

