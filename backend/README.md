# tutor-os-py

pydantic-ai 2.0 port of the (now retired) `src/mastra/**` + `src/server.ts`
Node/Mastra backend, built with `uv`. This is the only backend — Node has
been decommissioned.

## Run

```bash
cd py
uv run uvicorn tutor_os.server:app --port 4115 --reload
```

Serves the existing `frontend/` frontend unmodified over the same HTTP/SSE
contract the Node backend used to — env vars `OPENCODE_API_KEY` /
`OPENCODE_BASE_URL` (or `OPENAI_*`) work the same way.

Alternatively, `uv run tutor-os-py` runs the packaged entry point
(`tutor_os.server:main`), which reads the port from the `PORT` env var
(defaults to `4115` if unset) — e.g. `PORT=4117 uv run tutor-os-py`. The
`uvicorn ... --reload` form above always uses its own `--port` flag instead.

Set `TUTOR_OS_ROOT` to point at the repo root if running from somewhere other
than the default relative location (`backend/`'s parent).

Copy `.env.example` to `.env` and fill in a model gateway key before running
(there's no dotenv loader wired in — export it into your shell/process
manager, e.g. `export $(cat .env | xargs)`).

## Status

Ported and verified end-to-end (live, against the real model gateway):
storage/threads/messages (own SQLite file, `tutor-os-py.db`, separate from
the Node backend's `tutor-os.db`), `/api/chat` streaming (+ `/api/generate`
JSON) with `agentId` selection, threads, workspace, memory/meta endpoints,
config, learner profile, and SPA static serving.

### Agents vs. Skills

The TS source has 9 distinct agent personas plus a dead-code duplicate
(`subagents.ts`'s `reviewerAgent` is exported but never imported by
`index.ts`/`mcp.ts` — shadowed by `agents/reviewer.ts`, unreachable; not
ported). Rather than 1:1-porting every one as a separate `pydantic_ai.Agent`,
each was classified by whether it does genuinely autonomous multi-step tool
work (real agent, worth its own context) or is a single prompt-shaped
behavior with no tool loop of its own (a `pydantic-ai-harness` **Skill**,
loaded on demand into the Tutor's own context via `load_capability`):

- **Full agents**, selectable via `AGENTS`/`agentId`, real `agent.run()` A2A
  from the Tutor: **tutor** (hub), **assigner** (reads arcs+workspace, then
  decides what to write), **researcher** (iterative search; isolating its
  noisy tool output from the Tutor's context is the actual point of
  delegating).
- **Skills** (`backend/.agents/skills/`, wired into `tutor_agent` via
  `capabilities=[Skills(...)]`): **challenger**, **teacher**, **reviewer**
  (top-level Judgment Auditor — `capability_verify` is already on the
  Tutor's own tools), **planner**, **scaffolder**, **breaker**. These were
  A2A tools in the tracer-bullet pass; downgraded because delegating them
  cost a stateless round-trip for no benefit — worse for teacher/reviewer
  specifically, since A2A calls don't carry the Tutor's conversation
  history, which JIT teaching and judgment audits actually need. Verified
  live: `load_capability(id="challenger")` → skill body injected → Tutor
  answers in-character in the same turn, same thread history intact.

**Not yet ported** (tracked as the next incremental step):
- **pair**, **architect**, and **harvester** — sibling personas / an
  end-of-session consolidator, not on the Tutor's A2A path, deferred past
  this batch.
- Endpoints backed by not-yet-ported features: research panel proxy
  (`/api/research*`), rescue (`/api/rescue`), arcs/assignment/evidence
  mutation panels beyond what the Tutor's own tools cover, inbox,
  experiments.
- Auto-compact on long threads (`compactThread` in `server.ts`).
- Client-disconnect abort wiring (`server.ts` aborts the in-flight LLM/tool
  loop via `AbortController` on `res.on("close")`) — the Python SSE handler
  doesn't cancel the underlying agent run yet if the client disconnects.
- The Neovim plugin's SSE/JSON-RPC endpoints — out of scope per the
  migration's agreed scope (backend contract for `frontend/`/Tauri, nvim ignored).
