"use client";

import { useEffect, useRef } from "react";
import { useCopilot } from "./copilot-context";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ChatInterface() {
  const { messages, inputValue, setInputValue, runChat, isChatLoading, chatError } = useCopilot();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, chatError]);

  const handleSubmit = () => {
    if (!inputValue.trim() || isChatLoading) return;
    
    const text = inputValue;
    setInputValue("");
    runChat(text);
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-hidden p-4">
        <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <ChatMessage key={i} message={msg} />
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted text-muted-foreground">
                    <p className="text-sm animate-pulse">Thinking...</p>
                  </div>
                </div>
              )}
              {chatError && (
                 <div className="flex w-full justify-center">
                   <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
                     <p className="font-medium">Something went wrong</p>
                     <p className="text-xs opacity-90">{chatError}</p>
                   </div>
                 </div>
              )}
              <div ref={bottomRef} />
            </div>
        </ScrollArea>
      </div>
      <div className="shrink-0 border-t bg-background p-4">
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          disabled={isChatLoading}
          autoFocus
        />
      </div>
    </div>
  );
}

