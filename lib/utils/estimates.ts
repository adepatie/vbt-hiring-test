import type { EstimateStage } from "@/lib/zod/estimates";

export const formatEstimateStageLabel = (stage: EstimateStage | string) =>
  stage
    .toString()
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

// NOTE:
// For now we always keep users in the interactive flow UI (with stage sidebar
// and timeline), even when they reach the QUOTE stage. The "detail" view
// remains available but is not used as the primary entry point.
//
// If a dedicated post-flow completion state is added later, update
// FLOW_COMPLETION_STAGE and isEstimateFlowComplete accordingly.
export const FLOW_COMPLETION_STAGE: EstimateStage | null = null;

export const isEstimateFlowComplete = (stage: EstimateStage) =>
  FLOW_COMPLETION_STAGE !== null && stage === FLOW_COMPLETION_STAGE;


