"use client";

import { useCopilot } from "./copilot-context";
import { ChatInput } from "./chat-input";
import { ChatInterface } from "./chat-interface";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function CopilotShell({ children }: { children: React.ReactNode }) {
  const { isChatOpen, setChatOpen, actions, inputValue, setInputValue, runChat, isChatLoading } = useCopilot();

  const handleFloatingSubmit = () => {
    if (!inputValue.trim() || isChatLoading) return;
    const text = inputValue;
    setChatOpen(true);
    setInputValue("");
    runChat(text);
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {children}
        
        {/* Floating Action Bar (Central Chat Bar) */}
        <div 
          className={cn(
            "absolute bottom-0 left-0 right-0 p-4 pt-10 z-10 pointer-events-none transition-all duration-300 ease-in-out",
            // If chat is open, we might want to hide the input part of this bar or change its appearance. 
            // The plan says: "FloatingActionBar hides the input (actions remain)."
            "bg-gradient-to-t from-background via-background to-transparent"
          )}
        >
          <div className="w-full px-4 pointer-events-auto max-w-3xl mx-auto">
            {actions && (
              <div className="flex gap-2 justify-end items-center min-h-[52px] mb-2">
                {actions}
              </div>
            )}
            
            <div className={cn(
              "transition-all duration-300 ease-in-out overflow-hidden",
               isChatOpen ? "h-0 opacity-0" : "h-auto opacity-100"
            )}>
              <ChatInput 
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleFloatingSubmit}
              />
               <div className="mt-2 text-center text-xs text-muted-foreground">
                  Copilot can make mistakes. Check important info.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar (Chat Interface) */}
      <div
        className={cn(
          "flex h-full min-h-0 flex-col border-l bg-sidebar transition-all duration-300 ease-in-out",
          isChatOpen ? "w-[400px]" : "w-0 opacity-0 overflow-hidden"
        )}
      >
        <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Copilot</h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close Copilot chat"
              onClick={() => setChatOpen(false)}
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
        <ChatInterface />
      </div>
    </div>
  );
}

