# 0001 — pydantic-ai as the agent runtime

**Status:** Accepted
**Date:** 2026-09

## Context

The backend started as TypeScript on Mastra. Two things made that a bad fit:

- The learning domain is data work — episodes, evidence graphs, arc progress.
  Every non-trivial analysis meant reaching for Python anyway.
- Mastra owned the agent object. Switching models, injecting memory, or
  intercepting the tool loop meant working through its abstractions rather
  than against the model API.

The choice was between staying on Mastra, building directly on the raw model
SDK, or moving to a Python agent framework.

## Decision

Use **pydantic-ai** as the agent runtime, and make it the only backend. The
Node/Mastra implementation was deleted rather than kept in parallel.

What we rely on:

- **A `Model` instance per `agent.run(...)` call.** Runtime model switching
  never rebuilds an `Agent`, so `model.py` can hold mutable gateway config
  and every agent picks it up on the next call.
- **Plain functions as tools.** A tool is a module-level function; its
  signature becomes the schema and its docstring becomes the description the
  model reads. Tools stay independently importable and callable from HTTP
  handlers, which is how `server.py` reuses them without going through an
  agent at all.
- **`agent.instructions(fn)` hooks.** A callable re-evaluated on every run,
  which is what makes working memory injectable (ADR 0003).
- **`run_stream_events()`.** A flat event stream we translate into SSE
  frames, rather than a framework-owned transport.

## Consequences

**Tool docstrings are API contract, not commentary.** They are sent to the
model verbatim. Editing one for style changes agent behavior, so they are the
one place in this codebase where verbose prose is correct.

**No built-in memory primitive.** Mastra's `workingMemory` had no equivalent,
so it was rebuilt on an instructions hook. See ADR 0003.

**No workflow-with-suspend primitive.** The 4-phase session gate became a
small stateless state machine (`tools/session.py`) over the same SPEC.md /
STATE.md files, rather than a framework workflow. Less machinery, and the
phase state stays human-readable on disk.

**Python-only deployment.** The desktop shell has to ship a Python runtime
(ADR 0004), which is heavier than shipping a Node bundle would have been.

## Deferred

An MCP server was scoped out. Nothing in this repo needs it — the frontend
and desktop shell are both plain HTTP. It only matters for external clients
(Claude Desktop, Cursor). If picked up: stdio transport via the `mcp` Python
SDK, exposing the already-ported tools plus `ask_<agent>` per wired agent.
`agents/harvester.py` is complete but has no caller today for this reason.
