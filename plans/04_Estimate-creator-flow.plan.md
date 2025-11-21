# Estimate Creation Flow Routing

## Steps

1. **Define flow completion guard**  

- Add a helper in `lib/utils/estimates.ts` (or nearby) that reports when an estimate is “flow complete” (last stage reached).  
- Update server code to reuse the helper so stage comparisons stay consistent.

2. **Split routing between flow vs. detail**  

- Create `app/estimates/[projectId]/flow/page.tsx` that loads `estimatesService.getProjectWithDetails()` and renders the creation flow for non-complete projects.  
- Update `app/estimates/[projectId]/page.tsx` to redirect unfinished projects to the flow route and keep serving `ProjectDetailView` only when the helper says the flow is complete.  
- Adjust `ProjectList`’s `router.push` to send new projects directly to `/estimates/[projectId]/flow` so the sequence starts immediately after creation.

3. **Build the dedicated flow UI**  

- Extract the stage metadata + panels (artifacts, narratives, WBS, quote) from `project-detail-view.tsx` into shared subcomponents so both the flow and detail views stay in sync.  
- Implement a new `EstimateCreationFlow` client component (e.g., `project-flow-view.tsx`) that forces a sequential experience: always focus on the project’s current stage, provides context about what’s next, and keeps the editing controls active.  
- Add navigation/redirect guards so that hitting the flow URL after completion immediately sends the user back to the detail page.

4. **Lock down the detail screen**  

- Update `ProjectDetailView` to consume the shared stage components in a read-only mode (no edit buttons shown, or at least `canEdit` forced off) since it now only renders completed estimates.  
- Ensure any remaining mutation controls are either hidden or disabled, and add empty-state messaging to clarify that ongoing edits must happen via the copilot in the future.

5. **Regression passes**  

- Smoke-test Create Project → redirected flow path, manual refresh on flow vs. detail routes, and visiting a completed project from the list.  
- Run unit tests (`npm run test`) if feasible to confirm no regressions around stage transitions.