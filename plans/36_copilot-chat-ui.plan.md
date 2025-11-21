# Copilot Chat UI Implementation

## 1. Global Context & State Management

- **Move `ActionBarProvider` to Global Scope**: 
  - Move `app/estimates/[projectId]/action-bar-context.tsx` to `components/copilot/copilot-context.tsx` (or similar).
  - Extend it to include Chat State (`isChatOpen`, `messages`, `inputValue`).
  - Wrap `app/layout.tsx` (inside `Providers`) with this updated `CopilotProvider`.
  - Ensure `useActionBar` acts as a facade for `useCopilot` (or update usages) to maintain backward compatibility for actions.

## 2. Copilot Shell Component

- **Create `components/copilot/copilot-shell.tsx`**:
  - This component will be placed in `app/layout.tsx` to wrap `children`.
  - **Layout Structure**:
    ```tsx
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 flex flex-col relative min-w-0">
        {children}
        <FloatingActionBar /> {/* The "Central Chat Bar" */}
      </div>
      <ChatSidebar /> {/* The "Right Sidebar" */}
    </div>
    ```

  - **`FloatingActionBar`**:
    - Fixed at bottom-center of the main content area.
    - Renders `actions` (if any) and `ChatInput` (if chat is closed).
    - Styling: Gradient background fade-in from bottom, similar to current `FixedActionBar`.
  - **`ChatSidebar`**:
    - Collapsible right panel (width 0 -> width X).
    - Contains `ChatHistory` and `ChatInput` (fixed at bottom of sidebar).
    - Styling: Border-left, background similar to ChatGPT sidebar.

## 3. UI Components

- **`components/copilot/chat-input.tsx`**:
  - A reusable Textarea/Input component (auto-resizing).
  - Handles "Enter" to submit.
  - Used in both `FloatingActionBar` and `ChatSidebar`.
- **`components/copilot/chat-message.tsx`**:
  - Displays individual chat messages (User/AI).
- **`components/copilot/chat-interface.tsx`**:
  - The container for the sidebar content (Message Log + Input).

## 4. Integration & Refactoring

- **Update `app/estimates/[projectId]/project-flow-view.tsx`**:
  - Remove local `ActionBarProvider` and `FixedActionBar`.
  - Use the global `useCopilot` (or `useActionBar`) to set actions.
  - The global `CopilotShell` will now handle rendering these actions.
- **Update `app/estimates/[projectId]/project-detail-view.tsx`**:
  - Remove local `ActionBarProvider`.
- **Styling**:
  - Ensure the `FloatingActionBar` allows "click-through" on the gradient parts but captures clicks on the input/buttons (pointer-events).

## 5. Dashboard Integration

- Since `CopilotShell` wraps `children` in `RootLayout`, the chat bar will automatically appear on the Dashboard (`app/page.tsx`).
- Ensure z-indexes are correct so it floats above dashboard content.

## 6. Chat Behavior

- **Transition**:
  - User types in `FloatingActionBar` -> Press Enter.
  - `isChatOpen` becomes `true`.
  - `FloatingActionBar` hides the input (actions remain).
  - `ChatSidebar` expands.
  - Message is added to `ChatSidebar` history.