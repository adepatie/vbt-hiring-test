import {
  type BusinessCase,
  type EstimateStage,
  type Requirements,
  type SolutionArchitecture,
} from "@/lib/zod/estimates";

export const stageMeta: Record<
  EstimateStage,
  {
    title: string;
    summary: string;
    entryCriteria: string;
    type: "artifacts" | "narrative" | "wbs" | "quote";
  }
> = {
  ARTIFACTS: {
    title: "Artifacts",
    summary: "Collect existing documents, links, or notes for this project.",
    entryCriteria:
      "Gather at least the primary client brief and any discovery notes.",
    type: "artifacts",
  },
  BUSINESS_CASE: {
    title: "Business Case",
    summary: "Describe the business goals, success metrics, and constraints.",
    entryCriteria:
      "Artifacts uploaded and reviewed. Capture goals, risks, and desired outcomes.",
    type: "narrative",
  },
  REQUIREMENTS: {
    title: "Requirements",
    summary:
      "Translate the business case into prioritized requirements and acceptance criteria.",
    entryCriteria:
      "Business case approved. Requirements should cover scope, users, and constraints.",
    type: "narrative",
  },
  SOLUTION: {
    title: "Solution / Architecture",
    summary:
      "Outline the proposed solution, architecture decisions, and major risks.",
    entryCriteria:
      "Requirements finalized. Provide diagrams/description that address key needs.",
    type: "narrative",
  },
  EFFORT: {
    title: "Effort Estimate (WBS)",
    summary:
      "Break down the work into WBS items with task, role, and estimated hours.",
    entryCriteria:
      "Solution defined. Provide a complete WBS including QA, PM, and support.",
    type: "wbs",
  },
  QUOTE: {
    title: "Quote",
    summary:
      "Translate the WBS into pricing details, payment terms, and delivery timeline.",
    entryCriteria:
      "WBS approved. Provide pricing, payment schedule, and timeline for the client.",
    type: "quote",
  },
};

export const stageBadgeClass: Record<EstimateStage, string> = {
  ARTIFACTS: "bg-slate-100 text-slate-700",
  BUSINESS_CASE: "bg-purple-100 text-purple-700",
  REQUIREMENTS: "bg-blue-100 text-blue-700",
  SOLUTION: "bg-teal-100 text-teal-700",
  EFFORT: "bg-amber-100 text-amber-800",
  QUOTE: "bg-orange-100 text-orange-800",
};

export const stageDefinitions = stageMeta;

export type NarrativeRecord =
  | BusinessCase
  | Requirements
  | SolutionArchitecture
  | null;

