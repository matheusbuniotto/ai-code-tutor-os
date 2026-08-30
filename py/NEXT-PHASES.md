# Next Phases — pydantic-ai migration

Status as of the endpoints batch (research/memory/utility/arcs panels +
thread/compact). See `README.md` for what's already ported and verified.
This file tracks what's left, plus the reasoning to skip re-deriving it next
session.

## Done — agent roster batch

1. **`pair`, `architect` agents** — ported (`agents/pair.py`,
   `agents/architect.py`), wired into `server.py`'s `AGENTS` dict. `GET
   /api/status` now lists 5 agents: `tutor`, `assigner`, `researcher`,
   `pair`, `architect`.
2. **`harvester` agent** — ported (`agents/harvester.py`). Tools used:
   `state_update`/`state_read` (`tools/state.py`), `workspace_write`,
   `phase_set` (`tools/workspace.py`), `episodes_append`/`episodes_search`
   (`tools/episodes.py`), `evidence_record`/`evidence_list`
   (`tools/memory_audit.py`), `library_index`/`library_save_note`
   (`tools/living_library.py`), `os_read`/`os_write` (`tools/os_files.py`
   — matches TS's use of `osWrite` for `NOW.md`, not the newer
   `meta_set_now` helper). **Deliberately NOT wired into `AGENTS`** — same as
   the TS original, its only caller is the MCP server's `ask_harvester`,
   which is still out of scope (see open question #1). It's importable and
   structurally complete, just has no caller yet.
3. **Client-disconnect abort wiring** — `server.py`'s `event_source()` now
   runs `agent.run_stream_events()` as its own `asyncio.Task`
   (`_produce_agent_events`) feeding a queue, racing a disconnect-watcher
   task (`_watch_disconnect`) that polls `request.is_disconnected()` every
   0.5s. On disconnect the producer task is actually `.cancel()`'d in a
   `finally` block — real cancellation of the in-flight LLM/tool chain, not
   just dropped output. Verified live via `curl -N` (normal stream) and
   `curl -m 2` (forced disconnect, confirmed no orphaned task warnings).
   Side effect: extracting `_stream_event_frames`/`_consume_agent_stream`
   dropped `chat`/`event_source`'s cyclomatic complexity and nesting back
   under the prek thresholds (see below) — was pre-existing debt, now clean.

## Done — endpoints batch (all remaining HTTP surface from src/server.ts)

All 19 previously-unported endpoints now exist in `server.py` (45 routes
total). Ported in 5 sequential steps (all touch `server.py`, so run one at
a time — parallel agents would have merge-conflicted on the same file):

1. **Research panel** — `POST /api/research` (dual-mode: `web_search`/
   `arxiv_search`), `GET /api/research/dissections`, `POST
   /api/research/dissect` (`paper_dissect`), `POST
   /api/research/export-evidence` (builds an `L2Evidence` dict inline,
   different defaults than the `evidence_record` tool).
2. **Memory/evidence panel** — `GET /api/memory/graph`
   (`get_full_memory_graph`), `GET /api/memory/evidences` (thin wrapper over
   the existing `evidence_list` tool), `POST /api/memory/evidence/create`
   (upsert-by-id + auto-syncs the linked arc capability via a new
   `_sync_arc_capability_evidence` helper — extracted to satisfy
   `PLR1702`), `POST /api/memory/evidence/delete`.
3. **Utility panels** — `POST /api/rescue` (`rescue_diagnose`), `GET
   /api/library` (`library_index` — standalone, distinct from `/api/memory`),
   `POST /api/inbox` (raw `pathlib` append to `WORKSPACE_ROOT/INBOX.md`, not
   `os_write` — that tool is scoped to per-project paths, not root-level
   files), `GET`/`POST /api/experiments` (new: self-initializing
   `EXPERIMENTS.json` tracker, add/updateStatus/delete action-dispatch, no
   prior Python tool wrapped this).
4. **Arcs mutation panel** — `GET`/`POST /api/arcs` (bulk read/replace),
   `POST /api/arc/update` (raw upsert-by-id merge — NOT the same as the
   `arc_create_or_update` tool, which has a narrower LLM-facing param list;
   these endpoints use `read_arcs_data`/`save_arcs_data` directly to match
   the TS endpoint's exact merge semantics), `POST /api/arc/verify`, `POST
   /api/arc/delete`.
5. **`POST /api/thread/compact`** — hardest one. Needed new `db.py`
   plumbing: `save_message(...)` gained an optional `created_at` override
   (so the summary message can be backdated to sort before the kept tail),
   and a new `db.delete_before(thread_id, cutoff_created_at)` (deletes
   everything older than a cutoff — the TS version does this via a raw SQL
   lookup-by-id through the underlying Mastra storage client; Python's
   `db.list_messages` already gives the cutoff timestamp directly, so no
   equivalent lookup is needed). `_compact_thread()` lives in `server.py`
   itself (server-specific orchestration, not a reusable `tools/`
   function) — calls `AGENTS["tutor"].run(...)` to summarize, same Portuguese
   prompt as TS. Verified end-to-end live: seeded a throwaway thread past
   the `keepLast=16` threshold, confirmed a genuine LLM-generated summary
   message replaces the old messages and the kept tail is intact; also
   verified the `skipped: true` no-op path on a short thread.

**Prerequisite fix, done once up front** (both evidence-writing endpoints in
steps 1 and 2 needed it): `memory_audit.py`'s `L2Evidence` TypedDict had
`sourceRef`/`metric`/`reproductionCommand`/`arcId`/`capabilityId`/`notes`
declared as required `str` when the code (both the pre-existing
`evidence_record` tool and the new endpoints) always passes `str | None` —
fixed to `str | None`, which also resolved the ~14 pre-existing `ty`
diagnostics on that file mentioned in the prior gotchas list below.

`ui/index.html` previously got a `405` on `POST /api/research` from its own
background polling — should be resolved now that the route exists; worth
confirming next time the UI is exercised live.

## Open questions (deferred, need your call before touching)

1. **Is the MCP server (`src/mastra/mcp.ts`) in scope for this migration at
   all?** It exposes every agent + most tools as `ask_<agent>` / direct
   tools to external MCP clients (Neovim, Claude Desktop, Cursor,
   Windsurf...). Still open — decided to port `harvester` itself without
   building any MCP surface for it, so it now exists but has no caller in
   this port yet (matches the TS shape: MCP is its only caller there too).
2. Should **planner/scaffolder/breaker** (already ported as Skills, loaded
   by the Tutor) also get exposed as standalone MCP `ask_planner` etc., to
   match the TS original's external-tool surface — or is "the Tutor can
   load them as skills" the intended full replacement? Same question
   now applies to harvester too.
3. `src/mastra/workflows/session.ts` (`sessionWorkflow`) — pure deterministic
   state machine (phase tracking + human-gate suspend/resume over
   `STATE.md`), no LLM calls. Not yet ported to Python at all. Low urgency
   since nothing in the UI currently drives it, but it's the thing that
   actually sequences the 4-phase pyramid across sessions — worth doing
   before leaning on planner/scaffolder/breaker for a real multi-session
   project.

## Migration gotchas (carried forward, keep reading before porting more)

- **Introspect the installed `pydantic_ai`/`pydantic_ai_harness` package
  directly** (`uv run python -c "..."`) rather than trusting skill docs or
  web docs alone — both are fast-moving; e.g. `Skills` lives in the separate
  `pydantic-ai-harness` package (`uv add "pydantic-ai-harness[skills]"`),
  not in `pydantic-ai` itself.
- A formatter hook reformats `.py` files after every `Write`/`Edit` — always
  re-`Read` a file immediately before a follow-up `Edit` if the previous
  `old_string` might have been reformatted (wrapped lines, etc.).
- Keep the Node backend's SQLite file and the Python one separate
  (`tutor-os-py.db` vs `tutor-os.db`) — schemas differ enough that sharing
  risks corruption.
- The UI's `API_BASE` in `ui/index.html` is same-origin only when served
  from exactly `localhost:4115`; anything else (a different port, `file://`)
  makes it call `http://localhost:4115` cross-origin. Always run the Python
  server on **:4115** for manual UI testing (the Node backend's port) — a
  different port works but adds a needless cross-origin hop that's more
  fragile to transient errors, and some browsers (confirmed: Zen) choke on
  it where Safari/Chrome don't.
- `ruff check --fix src` after any batch of new tool/agent files; `uv run
  python -c "import tutor_os.server"` as a fast smoke test before a live
  server run.
- **`prek` is wired up** (`.pre-commit-config.yaml` at repo root, `uv run
  prek install` already run) — `ruff check`/`ruff format` (scoped to `py/`,
  with mccabe/pylint complexity+nesting rules: `C90`, `PLR0911/12/13/15`,
  `PLR1702`, `PLR2004`) plus `uvx ty check --project py "$@"` (scoped to
  staged files — NOT the whole project, that was a bug in the initial setup,
  fixed) and `uv lock --check` run on every commit's staged files. A handful
  of pre-existing ruff findings remain as accepted backlog in files nothing
  in these two batches needed to touch (e.g. `web_search`/`paper_dissect`'s
  complexity in `tools/research.py`/`tools/page_index.py`) — fix
  opportunistically if a future step touches those files for real.
- **Cosmetic `ruff --fix`/`ruff format` on an already-existing file is a
  trap**: even a zero-semantic-change fix (stale `noqa` removal, `UTC` alias
  swap) makes prek treat that file as genuinely touched on the next commit —
  which then surfaces ALL of that file's pre-existing complexity/nesting
  debt as a commit blocker, not just the one line you meant to tidy. Hit
  this repeatedly across both batches (`server.py`'s `logger` placement,
  `research.py`, `page_index.py`). Fix: when a step only needs to *import
  and call* an existing tool function, never run `ruff --fix`/`format`
  against that tool's file — leave it untouched. Only fix a file's debt for
  real when the step's actual logic change lives inside that file (as
  happened with `memory_audit.py`'s `L2Evidence` TypedDict, `db.py`'s new
  functions, and `server.py` throughout — all genuinely touched, so their
  debt was in-scope to fix).
- **`PLR0913` (too-many-arguments) is a false positive by design for
  `tools/*.py`**: those functions' flat kwargs ARE the LLM-facing
  `pydantic_ai.Tool` call schema, not incidental complexity — bundling them
  into a dict/dataclass would degrade tool-calling ergonomics for the LLM,
  not improve code quality. Exempted via `[tool.ruff.lint.per-file-ignores]`
  → `"src/tutor_os/tools/*.py" = ["PLR0913"]` in `pyproject.toml`. `PLR0913`
  stays enforced in `agents/`/`server.py`, where high arg counts are a real
  complexity signal.
- The `Tool(fn) for fn in TOOL_FUNCTIONS` pattern in every agent file trips
  one `ty` `invalid-argument-type` diagnostic (union of heterogeneous tool
  signatures vs. `Tool.__init__`'s expected shape) — confirmed present
  across `tutor.py`/`assigner.py`/`pair.py`/`architect.py`/`harvester.py`
  alike. Suppressed inline via `uvx ty check --add-ignore` (adds a scoped
  `# ty: ignore[invalid-argument-type]` comment on just that line) rather
  than a blanket rule downgrade — it's a pattern-level `ty`/pydantic-ai
  typing limitation, not a per-file bug. Any new agent file will need the
  same one-line suppression.
- FastAPI can't build a response model from a `dict | JSONResponse` return
  annotation (`FastAPIError: Invalid args for response field!`) — any
  endpoint that returns `JSONResponse` on an error branch and a plain dict
  on success needs `-> Any`, not a union type. Established convention now
  used throughout `server.py`.
