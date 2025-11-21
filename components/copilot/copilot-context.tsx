"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { CopilotLLMMessage } from "@/lib/copilot/types";
import { useCopilotAction } from "@/lib/copilot/hooks";

type PageContext = {
  workflow?: "estimates" | "contracts";
  entityId?: string;
  view?: string;
  entityType?: "project" | "agreement";
};

type CopilotContextType = {
  // Action Bar (Legacy & Integration)
  setActions: (actions: ReactNode) => void;
  actions: ReactNode;

  // Chat State
  isChatOpen: boolean;
  setChatOpen: (isOpen: boolean) => void;
  messages: CopilotLLMMessage[];
  setMessages: (messages: CopilotLLMMessage[]) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  addMessage: (message: CopilotLLMMessage) => void;
  
  // Chat Execution
  runChat: (message: string) => Promise<void>;
  isChatLoading: boolean;
  chatError: string | null;
  
  // Page Context
  setPageContext: (context: PageContext) => void;
  pageContext: PageContext;
};

const CopilotContext = createContext<CopilotContextType | undefined>(undefined);

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null);
  const [isChatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotLLMMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pageContext, setPageContext] = useState<PageContext>({});
  const [chatError, setChatError] = useState<string | null>(null);
  const router = useRouter();

  const { run: runChatAction, isLoading: isChatLoading } = useCopilotAction("chat.run", {
    onError: (err) => setChatError(err.message),
  });

  const addMessage = (message: CopilotLLMMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const runChat = async (message: string) => {
    setChatError(null);
    const userMsg: CopilotLLMMessage = { role: "user", content: message };
    
    const newMessages = [...messages, userMsg];
    setMessages(newMessages); // UI update
    
    try {
      const response = await runChatAction({
        messages: newMessages,
        workflow: pageContext.workflow,
        entityId: pageContext.entityId,
        view: pageContext.view,
        entityType: pageContext.entityType,
      });
      
      if (response && response.messages) {
        setMessages((prev) => {
          const base = prev.length ? prev : newMessages;
          const existingKeys = new Set(base.map(buildMessageKey));
          const merged = [...base];
          for (const msg of response.messages) {
            const key = buildMessageKey(msg);
            if (!existingKeys.has(key)) {
              existingKeys.add(key);
              merged.push(msg);
            }
          }
          return merged;
        });
      }

      if (response && response.shouldRefresh) {
        router.refresh();
      }
    } catch (e) {
      // Error is handled by onError callback
    }
  };

  return (
    <CopilotContext.Provider
      value={{
        actions,
        setActions,
        isChatOpen,
        setChatOpen,
        messages,
        setMessages,
        inputValue,
        setInputValue,
        addMessage,
        runChat,
        isChatLoading,
        chatError,
        setPageContext,
        pageContext,
      }}
    >
      {children}
    </CopilotContext.Provider>
  );
}

function buildMessageKey(message: CopilotLLMMessage) {
  const toolCallsKey =
    message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length
      ? JSON.stringify(message.tool_calls)
      : "";

  return [
    message.role,
    message.name ?? "",
    message.tool_call_id ?? "",
    toolCallsKey,
    message.content ?? "",
  ].join("|");
}

export function useCopilot() {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error("useCopilot must be used within a CopilotProvider");
  }
  return context;
}

// Backward compatibility for existing components
export function useActionBar() {
  const { actions, setActions } = useCopilot();
  return { actions, setActions };
}

