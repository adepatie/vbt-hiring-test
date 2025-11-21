# ChatGPT Theme & Layout Refactor Plan

## 1. Global Theme Update

- **File**: `app/globals.css`
- **Action**: Update CSS variables to match ChatGPT's dark theme color palette.
- Background: `#343541` (Main), `#202123` (Sidebar)
- Foreground: `#ECECF1`
- Card/Input: `#40414F`
- Accents: `#10a37f` (ChatGPT Green) or keep current primary if preferred, but adapted to dark theme.
- **Action**: Ensure dark mode is the default.

## 2. Estimates Layout (Sidebar)

- **File**: `app/estimates/layout.tsx` (Create)
- **Action**: Implement a layout with a fixed left sidebar and a main content area.
- **Content**:
- **Sidebar**:
- Top: "Back to Dashboard" (Link to `/`), "Contracts" (Link to `/contracts`).
- "New Project" Button.
- Scrollable list of projects (fetched via `estimatesService.listProjects()`).
- **Main**: `children` slot.

## 3. Estimates Empty State

- **File**: `app/estimates/page.tsx`
- **Action**: Update to show a centered "Select a project" message and a "Create New Project" button.
- **Note**: This page is rendered when no project is selected in the sidebar.

## 4. Action Bar Infrastructure

- **File**: `app/estimates/[projectId]/action-bar-context.tsx` (Create)
- **Action**: Create a React Context (`ActionBarContext`) to allow child components (forms) to render content into the fixed bottom action bar.
- **Exports**: `ActionBarProvider`, `useActionBar`.

## 5. Project Flow View Refactor

- **File**: `app/estimates/[projectId]/project-flow-view.tsx`
- **Action**:
- Wrap content in `ActionBarProvider`.
- **Layout**:
- **Header**: Project Name, Client, Stage Info (Top).
- **Main Content**: `StageContentPanel` (Scrollable middle section).
- **Right Sidebar**: `StageTimeline` (Moved from bottom).
- **Bottom Bar**: `FixedActionBar` component (consumes context).
- **Logic**:
- If the stage is completed (read-only), the `FixedActionBar` should display a "Copilot Input" mock.

## 6. Stage Panels Refactor

- **File**: `app/estimates/[projectId]/stage-panels.tsx`
- **Action**:
- Integrate `useActionBar` in `ArtifactsPanel`, `NarrativeStageForm`, `WbsEditor`, and `QuoteForm`.
- **Move Buttons**: Extract the action buttons (Save, Approve, Regenerate, etc.) from the JSX and pass them to `setActions` via `useEffect`.
- **Cleanup**: Remove the inline button containers.
- **Copilot Input**: Ensure that when `!canEdit`, the forms do not set actions, allowing the `FixedActionBar` to fall back to the "Copilot Input" view.

## 7. Component Updates

- **File**: `app/estimates/[projectId]/project-detail-view.tsx`
- **Action**: Apply similar layout changes if necessary, or ensure it doesn't break with the new global theme. (Focus is on Flow View).

## 8. UI Components

- **File**: `components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/button.tsx`
- **Action**: Verify styles look good on the new dark background.

## 9. Verification

- Check Dashboard (`/`) -> Should look like a dashboard but with new colors.
- Check Estimates (`/estimates`) -> Sidebar + Empty State.
- Check Project Flow (`/estimates/[id]/flow`) -> Sidebar + Main Content + Right Timeline + Bottom Action Bar.
- Check Completed Stage -> Bottom Bar shows Input.
- Check Active Stage -> Bottom Bar shows Action Buttons.