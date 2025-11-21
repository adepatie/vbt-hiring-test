"use client";

import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Message Copilot...",
  disabled,
  className,
  autoFocus
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className={cn("relative", className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-12 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        disabled={disabled}
        autoFocus={autoFocus}
      />
      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <Send className="h-5 w-5" />
      </button>
    </div>
  );
}

