import { describe, it, expect } from "vitest";

import type { CopilotLLMMessage } from "@/lib/copilot/types";
import { buildHistoryWindow } from "@/lib/copilot/history-utils";

const assistantToolMessage = (
  overrides: Partial<CopilotLLMMessage> = {},
): CopilotLLMMessage => ({
  role: "assistant",
  content: null,
  tool_calls: [{ id: "call-1", type: "function", function: { name: "noop" } }],
  ...overrides,
});

const toolMessage = (
  overrides: Partial<CopilotLLMMessage> = {},
): CopilotLLMMessage => ({
  role: "tool",
  content: "ok",
  name: "noop",
  tool_call_id: "call-1",
  ...overrides,
});

describe("buildHistoryWindow", () => {
  it("returns the original history when under the limit", () => {
    const history: CopilotLLMMessage[] = [
      { role: "system", content: "hi" },
      { role: "user", content: "hello" },
    ];

    expect(buildHistoryWindow(history, 10)).toEqual(history);
  });

  it("rewinds the window so tool responses keep their assistant pair", () => {
    const history: CopilotLLMMessage[] = [
      { role: "user", content: "first" },
      assistantToolMessage(),
      toolMessage(),
      { role: "user", content: "second" },
    ];

    const truncated = buildHistoryWindow(history, 2);

    expect(truncated).toHaveLength(3);
    expect(truncated[0].role).toBe("assistant");
    expect(truncated[1].role).toBe("tool");
  });

  it("drops orphaned tool messages if their assistant was trimmed away", () => {
    const history: CopilotLLMMessage[] = [
      { role: "user", content: "orphan" },
      toolMessage(),
      { role: "user", content: "follow-up" },
    ];

    const truncated = buildHistoryWindow(history, 2);
    expect(truncated.some((msg) => msg.role === "tool")).toBe(false);
  });
});

