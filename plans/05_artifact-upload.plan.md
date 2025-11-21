# Artifact Upload & Stage Gate

1. **Data & Type updates**

- Extend `prisma/schema.prisma` `Artifact` model with file metadata (`originalName`, `storedFile`, `mimeType`, `sizeBytes`) and run the matching `prisma migrate`.
- Mirror the new fields in `lib/zod/estimates.ts` (`artifactSchema`, `artifactInputSchema`, `projectDetailSchema`) and `app/estimates/[projectId]/project-types.ts` serializer so artifacts surface the download info on the client.

2. **Storage helper & API routes**

- Add a small helper in `lib/server/artifact-storage.ts` that writes uploaded files to `uploads/artifacts/<projectId>/` (ensure dir creation, sanitize filenames, return relative path) and deletes files when needed.
- Create `app/api/projects/[projectId]/artifacts/route.ts` (POST) that reads `FormData` (type, optional notes, file), calls the helper + `estimatesService` to create the DB record, and returns JSON; also add `app/api/artifacts/[artifactId]/file/route.ts` (GET) to stream the stored file back for downloads.
- Update `.gitignore` to exclude the `uploads/` directory so stored artifacts remain local-only.

3. **Service + actions alignment**

- Update `estimatesService.addArtifact` (and `artifactInputSchema`) to accept file metadata + disk path; ensure `removeArtifact` deletes the file via the helper.
- Introduce a guard inside `estimatesService.advanceStage` so transitions from `ARTIFACTS`→`BUSINESS_CASE` require at least two file-backed artifacts (checked server-side), throwing a descriptive error otherwise.
- Optionally expose a lightweight server action (or reuse the existing API) for the client to trigger a stage advance once requirements are met.

4. **Artifacts stage UI/UX**

- Revamp `ArtifactsPanel` to use a multipart/form upload (restrict extensions to `.txt/.pdf/.docx/.md`), show upload state, and display each artifact’s filename, size, and a download link hitting the new GET route.
- Surface validation messaging (e.g., “Upload at least two artifacts to continue”) and add an “Advance to Business Case” button that appears once two uploads exist; disabled/hidden otherwise.
- Ensure deletions refresh the view and respect the min-count requirement (cannot advance below two files) while keeping the rest of the stage panels unchanged.