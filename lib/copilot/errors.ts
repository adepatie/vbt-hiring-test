export type CopilotLLMErrorKind =
  | "config"
  | "auth"
  | "bad_request"
  | "rate_limit"
  | "server"
  | "connection"
  | "unknown";

export class CopilotLLMError extends Error {
  constructor(
    message: string,
    public readonly kind: CopilotLLMErrorKind,
    public readonly status?: number,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "CopilotLLMError";
  }
}

