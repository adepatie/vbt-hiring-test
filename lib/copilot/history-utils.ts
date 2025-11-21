import type { CopilotLLMMessage } from "./types";

export function buildHistoryWindow(
  messages: CopilotLLMMessage[],
  limit: number,
): CopilotLLMMessage[] {
  if (messages.length <= limit) {
    return messages;
  }

  let startIndex = Math.max(0, messages.length - limit);

  // Make sure we don't start mid tool-response block. If the slice would
  // begin with a tool message, rewind so we keep its paired assistant call.
  while (startIndex > 0 && messages[startIndex]?.role === "tool") {
    startIndex -= 1;
  }

  const window = messages.slice(startIndex);
  if (!window.length) {
    return window;
  }

  const normalized: CopilotLLMMessage[] = [];
  for (const message of window) {
    if (
      message.role === "tool" &&
      (!normalized.length ||
        normalized[normalized.length - 1].role !== "assistant" ||
        !normalized[normalized.length - 1].tool_calls)
    ) {
      // Skip orphaned tool messages. This can happen if history was truncated
      // inside the assistant/tool block or if a prior run logged malformed data.
      continue;
    }
    normalized.push(message);
  }

  return normalized;
}

