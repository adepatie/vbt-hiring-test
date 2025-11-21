import type { CopilotLLMResult } from "./providerClient";

export interface ContentRetryOptions {
  label: string;
  initialTokens: number;
  maxTokens?: number;
  maxAttempts?: number;
  callFactory: (maxTokens: number) => Promise<CopilotLLMResult>;
}

export async function callWithContentRetry({
  label,
  initialTokens,
  maxTokens = initialTokens * 2,
  maxAttempts = 3,
  callFactory,
}: ContentRetryOptions) {
  let attempt = 0;
  let tokens = initialTokens;
  let lastResult: CopilotLLMResult | null = null;

  while (attempt < maxAttempts) {
    lastResult = await callFactory(tokens);
    const content = (lastResult.content ?? "").trim();

    if (content.length > 0) {
      return { content, result: lastResult };
    }

    const shouldRetry =
      lastResult.finishReason === "length" && tokens < maxTokens;

    if (!shouldRetry) {
      return { content, result: lastResult };
    }

    const nextTokens = Math.min(
      Math.max(tokens + Math.ceil(tokens * 0.5), tokens + 500),
      maxTokens,
    );

    if (nextTokens <= tokens) {
      return { content, result: lastResult };
    }

    tokens = nextTokens;
    attempt += 1;

    console.warn(`[mcp][${label}] Retrying with ${tokens} max tokens`, {
      attempt,
      finishReason: lastResult.finishReason ?? null,
    });
  }

  return {
    content: (lastResult?.content ?? "").trim(),
    result: lastResult,
  };
}

export function truncateForPrompt(
  text: string,
  maxChars: number,
  label: string,
) {
  if (text.length <= maxChars) {
    return text;
  }
  const truncated = text.slice(0, maxChars);
  return `${truncated}\n\n[Truncated ${label} to ${maxChars} characters]`;
}

export function truncateForRequirements(text: string, maxChars: number) {
  return truncateForPrompt(text, maxChars, "for requirements prompt");
}

