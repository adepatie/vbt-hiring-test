import { z } from "zod";
import { CopilotLLMError, CopilotLLMErrorKind } from "../copilot/errors";
import {
  CopilotLLMMessage,
  CopilotToolChoice,
  CopilotToolDefinition,
} from "../copilot/types";

// --- Schemas for Validation ---

const ToolCallSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const ChoiceSchema = z.object({
  message: z.object({
    content: z.union([z.string(), z.null(), z.any()]).optional(),
    tool_calls: z.array(ToolCallSchema).optional(),
    refusal: z.string().nullable().optional(),
    annotations: z.any().optional(),
  }),
  finish_reason: z.string().nullable().optional(),
});

const OpenAIResponseSchema = z.object({
  id: z.string().optional(),
  choices: z.array(ChoiceSchema).optional(),
  output_text: z.string().optional(), // Legacy/Fallback support
  output: z.array(z.object({ content: z.string().nullable() })).optional(), // Legacy/Fallback support
  content: z.string().optional(), // Legacy/Fallback support
  usage: z
    .object({
      completion_tokens: z.number().optional(),
      completion_tokens_details: z
        .object({
          reasoning_tokens: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

export interface CallLLMOptions {
  systemPrompt?: string;
  messages: CopilotLLMMessage[];
  tools?: CopilotToolDefinition[];
  toolChoice?: CopilotToolChoice;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "json_object" | "text";
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface CopilotLLMResult {
  content: string | null;
  toolCalls?: unknown;
  finishReason?: string | null;
  rawResponse: unknown;
}

function readLlmConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY,
    baseUrl:
      process.env.OPENAI_BASE_URL ??
      process.env.LLM_API_BASE ??
      "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL ?? process.env.LLM_MODEL ?? "gpt-4o-mini",
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 90000),
    defaultMaxTokens: Number(process.env.LLM_MAX_OUTPUT_TOKENS ?? 1200),
    telemetry: process.env.ENABLE_LLM_LOGGING === "true",
  };
}

function ensureConfig() {
  const config = readLlmConfig();
  if (!config.apiKey) {
    throw new CopilotLLMError(
      "OPENAI_API_KEY is not configured.",
      "config",
      undefined,
      { env: ["OPENAI_API_KEY", "LLM_API_KEY"] },
    );
  }
  return config;
}

function buildHeaders() {
  const config = ensureConfig();
  const hdrs: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  return hdrs;
}

function estimatePromptStats(messages: CopilotLLMMessage[]) {
  const parts: string[] = [];

  for (const message of messages) {
    const content = message.content;
    if (typeof content === "string") {
      parts.push(content);
      continue;
    }

    if (Array.isArray(content)) {
      let joinedParts = "";
      for (const part of content as any[]) {
        if (!part) continue;
        if (typeof part === "string") {
          joinedParts += part;
        } else if (typeof (part as any).text === "string") {
          joinedParts += (part as any).text;
        } else if (typeof (part as any).content === "string") {
          joinedParts += (part as any).content;
        } else if (typeof (part as any).value === "string") {
          joinedParts += (part as any).value;
        }
      }
      parts.push(joinedParts);
      continue;
    }

    if (content && typeof content === "object") {
      try {
        parts.push(JSON.stringify(content));
      } catch {
        parts.push(String(content));
      }
      continue;
    }

    parts.push("");
  }

  const joined = parts.join("\n\n");

  const characters = joined.length;
  const tokens = characters ? Math.ceil(characters / 4) : 0;

  return {
    characters,
    tokens,
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout?.();
      reject(new CopilotLLMError("LLM call timed out", "connection"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: ReturnType<typeof readLlmConfig>,
  controller: AbortController,
  retries = 3,
  backoff = 1000,
): Promise<Response> {
  try {
    const response = await withTimeout(
      fetch(url, options),
      config.timeoutMs,
      () => {
        controller.abort();
        if (config.telemetry) {
          console.warn("[CopilotLLM] Aborted LLM request after timeout", {
            timeoutMs: config.timeoutMs,
          });
        }
      },
    );

    if (response.ok) return response;

    // Check for retryable status codes
    if (
      retries > 0 &&
      (response.status === 429 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 503)
    ) {
      if (config.telemetry) {
        console.warn(
          `[CopilotLLM] Request failed with ${response.status}, retrying in ${backoff}ms... (${retries} retries left)`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, backoff));
      // Clone options to avoid reusing consumed body stream if needed (though here body is string)
      return fetchWithRetry(
        url,
        options,
        config,
        controller,
        retries - 1,
        backoff * 2,
      );
    }

    return response;
  } catch (error) {
    if (retries > 0) {
      // Network errors or timeouts might also be retryable
      if (config.telemetry) {
        console.warn(
          `[CopilotLLM] Network error, retrying in ${backoff}ms... (${retries} retries left)`,
          error,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return fetchWithRetry(
        url,
        options,
        config,
        controller,
        retries - 1,
        backoff * 2,
      );
    }
    throw error;
  }
}

function describeMessageContent(content: unknown) {
  if (typeof content === "string") {
    return { type: "string", length: content.length };
  }
  if (Array.isArray(content)) {
    return {
      type: "array",
      length: content.length,
      items: (content as unknown[])
        .slice(0, 3)
        .map((part) => {
          if (!part || typeof part !== "object") {
            return { type: typeof part };
          }
          const obj = part as Record<string, unknown>;
          return {
            type: typeof obj.type === "string" ? (obj.type as string) : "object",
            keys: Object.keys(obj),
          };
        }),
    };
  }
  if (content === null) {
    return { type: "null" };
  }
  if (typeof content === "object") {
    return {
      type: "object",
      keys: Object.keys(content as Record<string, unknown>),
    };
  }
  return { type: typeof content };
}

export async function callProviderLLM({
  systemPrompt,
  messages,
  tools,
  toolChoice,
  maxTokens,
  temperature = 1,
  responseFormat = "text",
  signal,
}: CallLLMOptions): Promise<CopilotLLMResult> {
  const config = ensureConfig();
  const payloadMessages: CopilotLLMMessage[] = systemPrompt
    ? [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages,
      ]
    : messages;

  const promptStats = estimatePromptStats(payloadMessages);
  const effectiveMaxTokens = maxTokens ?? config.defaultMaxTokens;

  const body: Record<string, unknown> = {
    model: config.model,
    messages: payloadMessages,
    max_tokens: effectiveMaxTokens,
  };

  if (responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  if (tools?.length) {
    body.tools = tools;
  }

  if (toolChoice) {
    body.tool_choice = toolChoice;
  }

  if (config.telemetry) {
    console.info("[CopilotLLM] Request", {
      model: config.model,
      timeoutMs: config.timeoutMs,
      maxTokens: effectiveMaxTokens,
      messages: {
        count: payloadMessages.length,
        characters: promptStats.characters,
        tokens: promptStats.tokens,
      },
      hasTools: Boolean(tools?.length),
      hasToolChoice: Boolean(toolChoice),
      responseFormat,
    });
  }

  const controller = new AbortController();
  let abortSignal: AbortSignal = controller.signal;
  if (signal) {
    abortSignal = signal;
  } else if (
    typeof AbortSignal !== "undefined" &&
    typeof (AbortSignal as typeof AbortSignal & {
      any?: typeof AbortSignal.any;
    }).any === "function"
  ) {
    abortSignal = (AbortSignal as typeof AbortSignal & {
      any?: typeof AbortSignal.any;
    }).any!([controller.signal]);
  }

  try {
    const response = await fetchWithRetry(
      `${config.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(body),
        signal: abortSignal,
      },
      config,
      controller,
    );

    if (!response.ok) {
      let errorPayload: unknown;
      try {
        errorPayload = await response.json();
      } catch {
        errorPayload = await response.text();
      }

      const status = response.status;
      let kind: CopilotLLMErrorKind = "unknown";
      let message = `LLM request failed with status ${status}`;

      if (
        errorPayload &&
        typeof errorPayload === "object" &&
        "error" in errorPayload &&
        (errorPayload as any).error &&
        typeof (errorPayload as any).error.message === "string"
      ) {
        message = (errorPayload as any).error.message;
      }

      if (status === 401) {
        kind = "auth";
      } else if (status === 429) {
        kind = "rate_limit";
      } else if (status === 404) {
        kind = "bad_request";
        if (!message.includes("model")) {
          message = `LLM model '${config.model}' was not found. Check OPENAI_MODEL (or LLM_MODEL) and your base URL configuration.`;
        }
      } else if (status >= 400 && status < 500) {
        kind = "bad_request";
      } else if (status >= 500) {
        kind = "server";
      }

      if (config.telemetry) {
        console.error("[CopilotLLM] Upstream error", {
          status,
          message,
          raw: errorPayload,
        });
      }

      throw new CopilotLLMError(message, kind, status, errorPayload);
    }

    const rawData = await response.json();
    const parseResult = OpenAIResponseSchema.safeParse(rawData);

    if (!parseResult.success) {
      if (config.telemetry) {
        console.error(
          "[CopilotLLM] Response schema validation failed",
          parseResult.error,
        );
      }
      // Fallback to loose typing or throw?
      // For now, let's throw to enforce safety, but log the raw data first.
      throw new CopilotLLMError(
        "Invalid LLM response structure",
        "server",
        undefined,
        { validation: parseResult.error, raw: rawData },
      );
    }

    const data = parseResult.data;

    const choice = data.choices?.[0];
    let rawContent: unknown = choice?.message?.content;

    if (rawContent == null && data.output_text) {
      rawContent = data.output_text;
    } else if (rawContent == null && data.output?.[0]?.content != null) {
      rawContent = data.output[0].content;
    } else if (rawContent == null && data.content) {
      rawContent = data.content;
    }

    let content: string | null = null;

    if (typeof rawContent === "string") {
      content = rawContent;
    } else if (Array.isArray(rawContent)) {
      content = rawContent
        .map((part: any) => {
          if (!part) return "";
          if (typeof part === "string") return part;
          if (typeof part.text === "string") return part.text;
          if (typeof part.content === "string") return part.content;
          if (typeof part.value === "string") return part.value;
          return "";
        })
        .join("")
        .trim();
      if (!content.length) {
        content = null;
      }
    } else if (
      rawContent &&
      typeof rawContent === "object" &&
      typeof (rawContent as any).text === "string"
    ) {
      content = (rawContent as any).text;
    } else if (rawContent != null) {
      try {
        const stringified = JSON.stringify(rawContent);
        content = stringified;

        if (config.telemetry) {
          console.warn("[CopilotLLM] Unexpected content shape; stringified", {
            type: typeof rawContent,
            preview: stringified.slice(0, 200),
          });
        }
      } catch {
        content = String(rawContent);
      }
    }

    const result: CopilotLLMResult = {
      content,
      toolCalls: choice?.message?.tool_calls,
      finishReason: choice?.finish_reason ?? null,
      rawResponse: data,
    };

    if (config.telemetry) {
      const topLevelKeys = Object.keys(data);
      let messageKeys: string[] | null = null;
      if (choice?.message) {
        messageKeys = Object.keys(choice.message);
      }

      console.info("[CopilotLLM] Response", {
        finishReason: result.finishReason,
        hasToolCalls: Boolean(result.toolCalls),
        topLevelKeys,
        messageKeys,
      });

      if (!content || !content.length) {
        console.warn("[CopilotLLM] Empty assistant content payload", {
          finishReason: choice?.finish_reason ?? null,
          messageShape: describeMessageContent(choice?.message?.content),
          refusal: choice?.message?.refusal ?? null,
          annotations: choice?.message?.annotations ?? null,
          reasoningTokens:
            data.usage?.completion_tokens_details?.reasoning_tokens ?? null,
          completionTokens: data.usage?.completion_tokens ?? null,
        });
      }
    }

    return result;
  } catch (error) {
    if (error instanceof CopilotLLMError) {
      throw error;
    }

    throw new CopilotLLMError(
      error instanceof Error ? error.message : "Unknown LLM error",
      "connection",
    );
  } finally {
    controller.abort();
  }
}
