# Requirements Stage MCP Integration

1. **Audit current flow**

- Review `app/estimates/actions.ts`, `lib/copilot/actions.ts`, and MCP types/server to note current Business Case automation and identify touch points for a new Requirements tool.

2. **Design prompt + MCP plumbing**

- Create `lib/copilot/prompts/requirements.ts` with a lean prompt builder that consumes project name, artifact digest, and the saved Business Case draft.
- Extend MCP types/server/client to add an `estimates.generateRequirementsSummary` tool that invokes the prompt and calls the provider.

3. **Add copilot action + persistence**

- Implement `copilotActions.generateRequirementsFromBusinessCase` (or similar) that fetches project metadata, pulls artifact context + existing Business Case content, calls the new MCP helper, and saves the Requirements stage draft via `estimatesService.saveStageContent`.

4. **Trigger on stage advance + feedback**

- Update `advanceStageAction` (and any other stage transition helpers) so that when moving from `BUSINESS_CASE` to `REQUIREMENTS`, it invokes the new Copilot action, mirrors the loading UX, and propagates `CopilotLLMError` results just like the Business Case flow.

5. **Tests + verification**

- Add/extend Jest tests for the new copilot action and MCP client wiring, ensuring mocks cover project/artifact/business-case lookups, and verify stage advancement behavior. Re-run the suite.