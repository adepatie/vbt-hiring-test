## Overview

This project implements the “Multi‑Workflow System” from the hiring test: a small internal app with an Estimates workflow, a Contracts workflow, and a context‑aware Copilot. I treated the one‑week window as an AI‑assisted delivery exercise: use the models to move fast, but keep a clear architecture, thin vertical slices, and working tests at the core.

I started by turning the PDF + `requirements/test-prompt.txt` into an `ARCHITECTURE.md` that described the workflows, data model, and Copilot shape, then iterated feature‑by‑feature (bootstrapping, estimates flow, artifact uploads, MCP refactor, Copilot UI) using Cursor’s plan → implement → debug loop until the core flows were demoable end‑to‑end.

## AI tools I used and why

- **Cursor (chat, “Build”, and plan mode)**  
  This was my primary environment for code generation and refactors. Plan mode helped keep changes anchored to the spec (e.g., artifact upload, stage refactor, MCP registry) and made it safe to apply multi‑file edits. I also used Cursor’s agent to chase down stack traces and lints when something regressed.

- **GPT‑5.1 models (via Cursor and the app’s own MCP client)**  
  I used GPT‑5.1 both inside Cursor (for general coding) and inside the app itself for Business Case / Requirements / Solution / WBS generation via a typed LLM client and MCP server. The same tool surface is intended to power the future Copilot chat.

- **ChatGPT (pre‑repo architecture prompt)**  
  Before writing code, I used ChatGPT to help refine the initial architectural planning prompt that appears in `AI_ARTIFACTS.md`, then moved into Cursor once the repo and requirements were in place.

## Prompt strategy

- **Ground everything in the spec first**  
  I consistently pointed the agent at `requirements/test-prompt.txt` (and the PDF) and asked for clarifying questions before accepting any architecture or large code change, to ensure we were always aligned with the test’s expectations.

- **Work from small, explicit plans**  
  For each slice (bootstrap, DB setup, Estimates v1, artifact upload, LLM service, MCP refactor, Copilot chat UI) I requested or refined a dedicated `.plan.md`, then executed it in order instead of asking for a monolithic “build the whole app” response.

- **Iterate from concrete failures (tests and errors)**  
  When changes broke something, I pasted failing tests or runtime errors directly (rather than loosely describing symptoms) and asked Cursor to reason from that evidence. This worked well for things like Prisma schema issues, Next.js layout errors, and Copilot tool gating problems.

- **Constrain and correct the model when it drifted**  
  If Cursor over‑implemented (e.g., building features not in the plan) or misused a library (Chakra v3 APIs, Radix Select imports), I stopped, summarized what had gone wrong in my own words, and then narrowed the next prompt around the specific misstep.

## Biggest pivots / surprises

- **ChakraUI → shadcn UI**  
  I bootstrapped the UI with Chakra (as in my original architectural prompt), but GPT‑5.1 Codex repeatedly mixed v2/v3 APIs and theme config, creating brittle fixes. After several rounds of friction I pivoted to shadcn UI + Tailwind, which the model handled much more consistently and which simplified the ChatGPT‑style layout.

- **From direct OpenAI calls to an MCP tool layer**  
  The first LLM integration was a simple prompt helper for Business Case generation. As soon as I started planning a Copilot chat, that felt too ad‑hoc. I introduced a typed `callLLM` client and then a proper MCP server with a `MCP_TOOLS` registry and Zod‑backed tool schemas (including “read” tools), so both the UI buttons and future chat could safely reuse the same tools.

- **Refactoring to a ChatGPT‑like shell**  
  Mid‑project I refactored the Estimates experience into a ChatGPT‑style layout (sidebar projects, main stage view, right‑hand timeline, bottom action bar / future Copilot input). Doing this via AI‑assisted refactors across many components was risky but ultimately paid off in a more intuitive demo.

## What I’d do differently with more time

- **Deeper Contracts + cross‑workflow validation**  
  I’d flesh out the Contracts workflow to more fully match the spec: richer policy management, stronger SOW/MSA generation, and a complete “validate against estimate” path that cross‑checks WBS, quotes, and contract terms.

- **More systematic Copilot testing and observability**  
  I added tests for key server functions and MCP registry behavior, but with more time I’d add a focused suite around Copilot tools and side effects (especially cross‑workflow ones) and introduce better tracing/metrics for tool calls and token usage.

- **Prompt and performance tuning**  
  Some long‑running stages (especially Requirements and Solution) could be optimized further by tightening prompts, improving artifact summarization, and refining token limits. Given more time I’d iterate on those to make the Copilot feel snappier without losing fidelity.

- **Developer experience and seeding**  
  I’d invest in an even smoother dev path: a single `dev:reset` script that runs migrations + seeds, more realistic demo data for both workflows, and a couple of additional AI_ARTIFACTS sections that walk through the MCP refactor and Copilot wiring in more detail.
