import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

vi.mock("@/components/copilot/copilot-context", () => ({
  useCopilot: vi.fn(),
}));

import { ChatInterface } from "@/components/copilot/chat-interface";
import { CopilotShell } from "@/components/copilot/copilot-shell";
import type { CopilotLLMMessage } from "@/lib/copilot/types";
import { useCopilot } from "@/components/copilot/copilot-context";

const mockedUseCopilot = vi.mocked(useCopilot);

const createCopilotValue = (
  overrides: Partial<ReturnType<typeof baseCopilotValue>> = {},
) => ({
  ...baseCopilotValue(),
  ...overrides,
});

function baseCopilotValue() {
  return {
    actions: null,
    setActions: vi.fn(),
    isChatOpen: false,
    setChatOpen: vi.fn(),
    messages: [] as CopilotLLMMessage[],
    setMessages: vi.fn(),
    inputValue: "",
    setInputValue: vi.fn(),
    addMessage: vi.fn(),
    runChat: vi.fn(),
    isChatLoading: false,
    chatError: null as string | null,
    pageContext: {},
    setPageContext: vi.fn(),
  };
}

describe("ChatInterface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders conversation history, thinking indicator, and error alerts", () => {
    const toolMessage: CopilotLLMMessage = {
      role: "tool",
      name: "quote.generateTerms",
      content: "",
      meta: {
        type: "tool_status",
        status: "blocked",
        summary: "Project must reach Effort before running quote › generateTerms.",
        detail: "Advance the project stage to continue.",
      },
    };

    mockedUseCopilot.mockReturnValue(
      createCopilotValue({
        messages: [
          { role: "user", content: "Can you draft payment terms?" },
          { role: "assistant", content: "Sure, let me check the WBS first." },
          toolMessage,
          { role: "system", content: "System reminder" },
        ],
        isChatLoading: true,
        chatError: "Gateway timeout. Please retry.",
      }),
    );

    render(<ChatInterface />);

    expect(
      screen.getByText("Can you draft payment terms?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sure, let me check the WBS first."),
    ).toBeInTheDocument();
    expect(screen.getByText("quote › generateTerms")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Project must reach Effort before running quote › generateTerms.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("System reminder")).toBeInTheDocument();
    expect(screen.getByText("Thinking...")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText("Gateway timeout. Please retry."),
    ).toBeInTheDocument();
  });

  it("submits the chat input when Enter is pressed", async () => {
    const user = userEvent.setup();
    const runChat = vi.fn();
    const setInputValue = vi.fn();

    mockedUseCopilot.mockReturnValue(
      createCopilotValue({
        inputValue: "Generate the business case outline",
        runChat,
        setInputValue,
      }),
    );

    render(<ChatInterface />);

    const textbox = screen.getByRole("textbox");
    await user.click(textbox);
    fireEvent.keyDown(textbox, { key: "Enter", code: "Enter" });

    expect(setInputValue).toHaveBeenCalledWith("");
    expect(runChat).toHaveBeenCalledWith("Generate the business case outline");
  });
});

describe("CopilotShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows floating actions and input when chat is closed", () => {
    mockedUseCopilot.mockReturnValue(
      createCopilotValue({
        actions: <button>Custom Action</button>,
        inputValue: "",
      }),
    );

    render(
      <CopilotShell>
        <div>Main content</div>
      </CopilotShell>,
    );

    expect(screen.getByText("Main content")).toBeInTheDocument();
    expect(screen.getByText("Custom Action")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Message Copilot...")[0]).toBeEnabled();
    expect(
      screen.getByText("Copilot can make mistakes. Check important info."),
    ).toBeInTheDocument();
  });

  it("submits from the floating input and opens the chat sidebar", async () => {
    const user = userEvent.setup();
    const runChat = vi.fn();
    const setInputValue = vi.fn();
    const setChatOpen = vi.fn();

    mockedUseCopilot.mockReturnValue(
      createCopilotValue({
        inputValue: "Show me the latest quote draft",
        runChat,
        setInputValue,
        setChatOpen,
      }),
    );

    render(
      <CopilotShell>
        <div />
      </CopilotShell>,
    );

    const [floatingInput] = screen.getAllByPlaceholderText("Message Copilot...");
    await user.click(floatingInput);
    fireEvent.keyDown(floatingInput, { key: "Enter", code: "Enter" });

    expect(setChatOpen).toHaveBeenCalledWith(true);
    expect(setInputValue).toHaveBeenCalledWith("");
    expect(runChat).toHaveBeenCalledWith("Show me the latest quote draft");
  });

  it("renders the chat sidebar when open and closes via the header button", async () => {
    const user = userEvent.setup();
    const setChatOpen = vi.fn();

    mockedUseCopilot.mockReturnValue(
      createCopilotValue({
        isChatOpen: true,
        setChatOpen,
      }),
    );

    render(
      <CopilotShell>
        <div />
      </CopilotShell>,
    );

    expect(screen.getByText("Copilot")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Close Copilot chat" }),
    );
    expect(setChatOpen).toHaveBeenCalledWith(false);
  });
});


