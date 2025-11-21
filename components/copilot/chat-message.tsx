"use client";

import { cn } from "@/lib/utils";
import type { CopilotLLMMessage } from "@/lib/copilot/types";

interface ChatMessageProps {
  message: CopilotLLMMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const isSystem = message.role === "system";

  if (isTool) {
    const toolMeta =
      message.meta && message.meta.type === "tool_status" ? message.meta : null;
    const status = toolMeta?.status ?? "success";
    const statusLabel =
      status === "error"
        ? "Error"
        : status === "blocked"
          ? "Blocked"
          : "Success";
    const badgeClasses =
      status === "error"
        ? "bg-destructive/15 text-destructive border border-destructive/30"
        : status === "blocked"
          ? "bg-amber-300/10 text-amber-700 border border-amber-400/40"
          : "bg-background/60 text-muted-foreground border border-border/30";
    const bubbleClasses =
      status === "error"
        ? "border border-destructive/40 bg-destructive/10"
        : status === "blocked"
          ? "border border-amber-400/40 bg-amber-100/40"
          : "bg-muted/70";
    const summaryText =
      toolMeta?.summary ??
      (message.content ? message.content : "Tool completed.");
    const detailContent =
      toolMeta?.detail && status !== "success" ? toolMeta.detail : null;
    const label =
      toolMeta?.label ??
      (message.name ? message.name.replace(/\./g, " › ") : "Tool response");

    return (
      <div className="flex w-full justify-start">
        <div
          className={cn(
            "max-w-[80%] space-y-2 rounded-lg px-4 py-3 text-sm text-foreground break-words",
            bubbleClasses,
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                badgeClasses,
              )}
            >
              {statusLabel}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground break-words">
            {summaryText}
          </p>
          {detailContent ? (
            <p className="text-xs text-muted-foreground break-words">{detailContent}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2",
          isUser
            ? "bg-primary text-primary-foreground"
            : isSystem
              ? "bg-muted/60 text-muted-foreground"
              : "bg-muted text-muted-foreground",
        )}
      >
        <p className="whitespace-pre-wrap text-sm break-words">
          {message.content || (isSystem ? "(system message)" : "")}
        </p>
      </div>
    </div>
  );
}

