import { CopilotLLMError } from "../copilot/errors";
import { ReadOnlyStageError } from "../services/stageRules";
import type { McpLLMResponse, McpErrorResponse, McpSuccessResponse } from "./types";

export function normalizeCopilotError(error: unknown): CopilotLLMError {
  if (error instanceof CopilotLLMError) {
    return error;
  }

  if (error instanceof ReadOnlyStageError) {
    return new CopilotLLMError(error.message, "bad_request", 409);
  }

  const message =
    error instanceof Error ? error.message : "Unknown LLM error";

  return new CopilotLLMError(message, "unknown");
}

export function toSuccessResponse(
  requestId: string | undefined,
  result: McpLLMResponse,
): McpSuccessResponse {
  return {
    requestId,
    result,
  };
}

export function toErrorResponse(
  requestId: string | undefined,
  error: unknown,
): McpErrorResponse {
  const normalized = normalizeCopilotError(error);
  return {
    requestId,
    error: {
      kind: normalized.kind,
      message: normalized.message,
      detail: normalized.detail,
      status: normalized.status,
    },
  };
}

export function copilotErrorFromPayload(
  payload: McpErrorResponse["error"],
): CopilotLLMError {
  return new CopilotLLMError(
    payload.message,
    payload.kind,
    payload.status,
    payload.detail,
  );
}

