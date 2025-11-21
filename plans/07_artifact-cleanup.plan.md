# Artifact Summary Cleanup

## Goal

Finish the summary-only artifact flow: ensure DB schema/docs/tests match reality, provide better UI cues and project context for summaries, and reduce noisy logging.

## Steps

1. **Schema & code alignment**

- Lower `artifactSchema.content` limit (e.g., 10k chars) with a clear code comment describing summary-only storage (skip `AI_ARTIFACTS.md` per request).
- Update relevant tests (e.g., `tests/estimatesService.test.ts`) or inline comments to reflect the new max length and summary behavior.

2. **Project-aware summarization**

- In `app/api/projects/[projectId]/artifacts/route.ts`, fetch the project name before summarizing and pass it to `summarizeArtifactForStorage` so summaries include context.
- Handle errors efficiently (reuse the existing `ensureProject` logic via `estimatesService` where possible).

3. **Legacy artifact handling**

- Introduce a utility (or migration hook in `buildArtifactContext`) that detects older artifacts (e.g., those lacking the `[AI-generated summary…]` banner) and re-summarizes them once, storing the result back in the DB.
- Provide a script/test to validate the re-summarization path.

4. **Frontend UX polish**

- Add a “View all artifacts” link or button from the overview card to the Stage panel, ensuring users can access downloads for summarized entries.
- Maintain the “AI-generated summary” labels and consider tooltip/callout explaining how to retrieve full files.

5. **Telemetry & tests cleanup**

- Silence the artifact-summary warning log during Vitest runs (e.g., stub `console.warn` in the specific test) to keep CI output clean.
- Update `tests/estimatesService.test.ts` to assert the new summary banner instead of raw text.

Once complete, the system will consistently store only summaries, expose project-aware context, provide clear UI access to original files, and keep docs/tests/telemetry aligned with the behavior.