export type CopilotRole = "system" | "user" | "assistant" | "tool";

export type CopilotToolStatusMeta = {
  type: "tool_status";
  label: string;
  status: "success" | "error" | "blocked";
  summary: string;
  detail?: string;
};

export interface CopilotLLMMessage {
  role: CopilotRole;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
  meta?: CopilotToolStatusMeta;
}

export interface CopilotToolFunction {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface CopilotToolDefinition {
  type: "function";
  function: CopilotToolFunction;
}

export type CopilotToolChoice =
  | "auto"
  | "none"
  | { type: "function"; function: { name: string } };

export type CopilotWorkflow = "estimates" | "contracts";

import type { EstimateStage } from "../zod/estimates";

export type SideEffectContext = {
  workflow?: string;
  entityId?: string;
  entityType?: "project" | "agreement";
  projectStage?: EstimateStage;
};
