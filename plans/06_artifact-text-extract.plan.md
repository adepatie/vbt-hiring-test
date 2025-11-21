## Artifact Text Ingestion for Estimates Copilot

### Goal

Parse `.txt`, `.md`, `.pdf`, and `.docx` artifacts server-side, store extracted text in the `Artifact.content` field, and feed that text into the Estimates Copilot prompts so the OpenAI API has access to real document content alongside the existing digest.

### 1. Add text-extraction utilities

- **Dependencies**
- Add lightweight server-side libraries for parsing:
- `pdf-parse` (or similar) for `.pdf`.
- `mammoth` for `.docx`.
- **Helper module**
- Create a new helper (e.g. `lib/server/artifact-text.ts`) or extend `lib/server/artifact-storage.ts` with:
- `extractArtifactText(absolutePath: string, opts: { extension: string; mimeType?: string }): Promise<string>`
- `.txt` / `.md`: read file as UTF-8, normalize whitespace, and trim.
- `.pdf`: use the PDF library to extract text, normalize, and trim.
- `.docx`: use the DOCX library to extract text, normalize, and trim.
- Apply a conservative max-length (e.g. 18–19k chars) so that, when combined with notes, it stays under the Zod `content` limit of 20k.

### 2. Store extracted text at upload time

- **Upload route wiring** (`app/api/projects/[projectId]/artifacts/route.ts`)
- After `saveArtifactFile(projectId, file)` returns, resolve the absolute path to the stored file (using `resolveArtifactFilePath`).
- Call `extractArtifactText` with the absolute path and extension/mime.
- Build a merged `artifactContent` string from:
- Optional user `notes` (if present), then
- A clear separator (e.g. `"\n\n---\n\n[Extracted file text]\n\n"`), then
- The extracted file text (if any).
- Truncate `artifactContent` to the 20k-character Zod limit.
- Pass this `artifactContent` into `estimatesService.addArtifact` as the `content` field, along with the existing file metadata.

### 3. Confirm models and schemas

- **Prisma / Zod alignment**
- Confirm no Prisma schema changes are needed (`Artifact.content` already exists as `String?`).
- Ensure `lib/zod/estimates.ts` `artifactSchema` and `artifactInputSchema` remain compatible (max length 20k); adjust only if the combined text length demands a small buffer.

### 4. Enrich Copilot context with raw artifact text

- **Context builder** (`lib/copilot/context/estimates.ts`)
- Extend `ArtifactContext` with a new field such as `rawText: string` (or `artifactsRawText: string`).
- In `buildArtifactContext`, in addition to the existing `digestText`, construct `rawText` by:
- Including only file-backed artifacts (those with `storedFile`) to prioritize real documents.
- Prefixing each artifact’s text with a small header (`"[Artifact N: type (filename)]"`).
- Concatenating `artifact.content` values, applying a global length cap (e.g. 8–12k chars) to keep prompts token-safe.
- Keep the existing digest behavior unchanged for UI and high-level summaries.

### 5. Inject raw text into the Estimates Copilot prompts

- **Prompt input shape** (`lib/copilot/prompts/estimates.ts`)
- Extend `BusinessCasePromptInput` with a new optional field, e.g. `artifactsRawText?: string`.
- In `buildBusinessCasePrompt`, if `artifactsRawText` is non-empty, append a new section to `userContent`, e.g.:
- `Artifacts raw text (truncated):` followed by the combined `artifactsRawText`.
- **Copilot action wiring** (`lib/copilot/actions.ts`)
- In `generateBusinessCaseFromArtifacts`, when building the prompt:
- Continue passing `artifactsSummary: context.digestText`.
- Also pass `artifactsRawText: context.rawText` (or whatever field name you chose in the context).
- Leave `generateEstimateStageDraft` and the LLM client as-is; the richer prompt content is carried in the `messages` payload.

### 6. Tests and documentation

- **Tests**
- Update or add tests in `tests/estimatesService.test.ts` to verify that:
- When a mock extractor returns text and notes are provided, `content` stores the merged notes + extracted text, truncated to the configured limit.
- Update or add tests in `tests/copilotPrompts.test.ts` to assert that:
- `buildBusinessCasePrompt` includes the "Artifacts raw text" section when `artifactsRawText` is provided.
- **Docs**
- Update `AI_ARTIFACTS.md` (and optionally `APPROACH.md`) to document the ingestion pipeline:
- Upload → filesystem storage → server-side text extraction → `Artifact.content` → Copilot context (`digestText` + `rawText`) → prompt payload.