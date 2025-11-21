import { NextResponse } from "next/server";
import { z } from "zod";

import { copilotActions } from "@/lib/copilot/actions";
import { normalizeCopilotError } from "@/lib/mcp/errorHelpers";

const requestSchema = z.object({
  action: z.string().min(1, "Action is required."),
  payload: z.unknown().optional(),
  workflow: z.enum(["estimates", "contracts"]).optional(),
  entityId: z.string().optional(),
  view: z.string().optional(),
  message: z.string().optional(),
});

type CopilotRequest = z.infer<typeof requestSchema>;

export async function POST(request: Request) {
  let body: CopilotRequest;

  try {
    const json = await request.json();
    body = requestSchema.parse(json);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid request payload."
        : "Unable to parse request payload.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { action, payload, workflow, entityId, view, message } = body;

  const handler = (copilotActions as Record<string, unknown>)[action];

  if (typeof handler !== "function") {
    return NextResponse.json(
      { error: `Unknown Copilot action: ${action}` },
      { status: 400 },
    );
  }

  try {
    const result = await (handler as (input: unknown) => Promise<unknown>)(
      payload,
    );

    // Handle chat.run response which already contains messages
    if (
      result &&
      typeof result === "object" &&
      "messages" in result &&
      Array.isArray((result as any).messages)
    ) {
      return NextResponse.json({ result }, { status: 200 });
    }

    const summaryMessage =
      action === "generateBusinessCaseFromArtifacts"
        ? "Generated a new Business Case draft from artifacts."
        : "Copilot action completed.";

    return NextResponse.json(
      {
        messages: [
          {
            role: "assistant" as const,
            content: summaryMessage,
          },
        ],
        context: {
          workflow: workflow ?? null,
          entityId: entityId ?? null,
          view: view ?? null,
          userMessage: message ?? null,
        },
        result,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[copilot-api]", error);

    const normalized = normalizeCopilotError(error);

    return NextResponse.json(
      { error: normalized.message, kind: normalized.kind, detail: normalized.detail ?? null },
      { status: normalized.status ?? 500 },
    );
  }
}
