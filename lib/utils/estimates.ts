import type { EstimateStage } from "@/lib/zod/estimates";

export const formatEstimateStageLabel = (stage: EstimateStage | string) =>
  stage
    .toString()
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");


