# Next Phases — pydantic-ai migration

**Migration complete: Python is the only backend.** The Node/Mastra backend
(`src/mastra/**`, `src/server.ts`, `src/mcp.ts`) has been deleted — see
"Done — Node backend decommissioned" near the end of this file. This file
tracks the full migration history and remaining gotchas; the only
genuinely open item is the deferred MCP server (see that section).

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

## Done — working memory / dynamic learner profile

Ported the `workingMemory` feature of `src/mastra/memory.ts` — the highest-
value gap from the parity audit below, since it affects every conversation's
quality, not just an edge-case endpoint.

- **New `tools/working_memory.py`**: `build_learner_profile_template()` is a
  line-for-line port of TS's `buildLearnerProfileTemplate()` (same sections:
  Perfil Cognitivo & Afetivo, Invariantes Operacionais, Níveis por Stack,
  Calibração "Fácil", Padrões de Bloqueio, Política de Rewards,
  Microvitórias). `get_working_memory()` reads the persisted doc, seeding it
  from the template on first read. `update_working_memory(section, content)`
  is the LLM-facing tool. `inject_working_memory()` is the dynamic
  instructions hook.
- **Persistence: `workspace/_meta/WORKING_MEMORY.md`**, a plain file — not a
  new `db.py` table. Chose this over SQLite because (a) this app has exactly
  one resource (`RESOURCE_ID`), so there's no multi-tenant key to index on,
  and (b) it matches every other `_meta/*.md` file's pattern (`PROFILE.md`,
  `NOW.md`, `LIBRARY.md`) rather than introducing a one-off table for a
  single row. Deliberately a **separate file from `tools/state.py`'s
  `PROFILE.md`** — same as in TS, where `memory.ts`'s workingMemory template
  and `state.ts`'s PROFILE.md are two independent systems: PROFILE.md is
  read once at session start via an explicit `state_read` tool call and
  written only by the Harvester; WORKING_MEMORY.md is auto-injected into
  *every single call* and editable by any agent.
- **Injection**: every agent file (`tutor.py`, `assigner.py`,
  `researcher.py`, `pair.py`, `architect.py`, `harvester.py`) now calls
  `<agent>.instructions(inject_working_memory)` right after construction —
  pydantic-ai's dynamic-instructions hook (same mechanism as
  `@agent.instructions`, called directly instead of as a decorator since the
  agents are built as module-level constants, not inside a function body).
  This re-reads the doc fresh on every `.run()` call, unlike the rest of
  each agent's `personalize()`'d instructions, which freeze at
  module-import time — required, since working memory must reflect edits
  made *within* the current session, not just after a restart.
- **Deviation from TS, deliberate**: Mastra's native `updateWorkingMemory`
  tool replaces the *whole* document in one shot (`{memory: string}`
  schema). This ports `tools/state.py`'s section-scoped regex-replace
  convention instead (`update_working_memory(section: Literal[...],
  content: str)`) — letting the LLM resend the entire document every turn
  risks silent truncation of sections it doesn't feel like repeating; a
  `Literal` section enum is also a tighter tool schema than a free-form
  string.
- **Known minor limitation**: the "Perfil Cognitivo & Afetivo" section's
  header can carry a `({cognitive_tag})` suffix in the *seed* template (when
  `has_neuropsych_rescue_profile` is set); the update tool's regex tolerates
  matching that suffixed header (`[^\n]*` after the header text — a real bug
  hit and fixed during this step's live testing, since a naive exact-match
  regex silently duplicated the section instead of replacing it), but the
  *replacement* it writes back always uses the bare header, so the tag
  suffix is dropped from display after the first LLM-driven edit to that
  one section. The tag itself isn't lost (still lives in
  `LearnerProfile.cognitive_tag`), just its inline display in that one
  section header. Not fixed — narrow, cosmetic, and only affects the one
  section with a dynamic header.
- **Verified live**: sent a real chat turn asking the Tutor to register
  Python/Rust stack levels; confirmed `update_working_memory` was actually
  called (not just described in text) and `WORKING_MEMORY.md` on disk
  changed accordingly. Then sent a message on a **brand-new, empty thread**
  asking what stack levels were on file — the agent correctly recalled them
  purely from the injected working-memory doc (zero thread history),
  confirming true resource-scoped (cross-thread) injection, matching
  Mastra's `scope: "resource"`.
- `ruff check`/`ruff format` clean on all 7 touched files; `uvx ty check`
  needed `--add-ignore` on `tutor.py`/`assigner.py`/`researcher.py` (the
  `invalid-argument-type` pattern from adding one more tool to their
  `Tool(fn) for fn in TOOL_FUNCTIONS]` union — `pair.py`/`architect.py`/
  `harvester.py` already had the suppression from a prior batch).

## Done — standalone challenger, reviewer, teacher agents

Ported `agents/challenger.ts`, `agents/reviewer.ts`, `agents/teacher.ts` to
`agents/challenger.py`, `agents/reviewer.py`, `agents/teacher.py` following
the `pair.py`/`architect.py` pattern exactly. All three already existed as
Skills (`py/.agents/skills/{challenger,reviewer,teacher}/`) — those are
untouched, the Tutor still loads them contextually; these are the
standalone, independently-chat-selectable versions, matching how TS has
both simultaneously (`mastra.getAgent("challenger")` alongside the Tutor's
own contextual use).

- Wired into `server.py`'s `AGENTS` and `_AGENT_TOOL_FUNCTIONS` dicts —
  `GET /api/status` now lists 8 agents: `tutor`, `assigner`, `researcher`,
  `pair`, `architect`, `challenger`, `reviewer`, `teacher`.
- All 3 get the working-memory wiring from the previous step
  (`inject_working_memory` + `update_working_memory` tool) — TS doesn't
  have this yet at all, so Python is now ahead here, not just at parity.
- **Deviation, deliberate**: TS's `challenger.ts` has
  `${learnerProfile.hasNeuropsychRescueProfile ? " (cognitive tag)" : ""}`
  hardcoded inline. Ported using the existing `{{COGNITIVE_TAG}}`
  `personalize()` token instead (`f" ({p.cognitive_tag})" if
  p.cognitive_tag else ""` — already defined in `learner_profile.py`,
  already used by `pair.py`) — same conditional behavior, but data-driven
  from the actual profile instead of a hardcoded score, consistent with
  this file's own stated design goal ("kept out of hardcoded agent
  instructions so the same agent code serves any learner").
- `ruff`/`ty`/`prek` all clean, no new suppressions needed beyond the
  standard `# ty: ignore[invalid-argument-type]` on each new agent's
  `Tool(fn) for fn in TOOL_FUNCTIONS]` line.
- **Verified live**: started the server, created a thread with
  `agentId: "challenger"`, sent a real message describing a Go mutex
  counter "working" in a local test. Confirmed via SSE stream: the agent
  called `arcs_list` (tool wiring), called `update_working_memory` with a
  genuine observation about the learner's testing habits (working-memory
  wiring), and produced real challenger-persona adversarial text
  ("prove que isso não é o seu teste que está acomodado, e não o seu
  contador que está correto..."). Reverted the test-generated
  `workspace/_meta/WORKING_MEMORY.md` content before committing (same
  gotcha as the previous step — this file is generated runtime state, not
  tracked seed data, unlike `NOW.md`/`PROFILE.md`).

## Done — standalone planner, scaffolder, breaker agents

Ported `agents/subagents.ts`'s remaining three (`plannerAgent`,
`scaffolderAgent`, `breakerAgent`) to `agents/planner.py`, `agents/scaffolder.py`,
`agents/breaker.py`, following the same pattern as challenger/reviewer/teacher.
All three already existed as Skills (`py/.agents/skills/{planner,scaffolder,breaker}/`)
— untouched, Tutor still loads them contextually; these are the standalone,
independently-chat-selectable versions.

- Wired into `server.py`'s `AGENTS` and `_AGENT_TOOL_FUNCTIONS` dicts —
  `GET /api/status` now lists 11 agents: `tutor`, `assigner`, `researcher`,
  `pair`, `architect`, `challenger`, `reviewer`, `teacher`, `planner`,
  `scaffolder`, `breaker`.
- **`harvester` deliberately NOT wired in** — user decision: keep it
  backend-only, same as TS, same as it's been since the agent-roster batch.
  Still only reachable by other agents/workflows, not by `POST /api/chat`.
- All 3 get the working-memory wiring (`inject_working_memory` +
  `update_working_memory`), matching the rest of the roster.
- **Deviation, deliberate, same class as challenger's**: TS's `breaker.ts` has
  `${learnerProfile.hasNeuropsychRescueProfile ? " (cognitive tag)" : ""}`
  hardcoded inline. Ported using the `{{COGNITIVE_TAG}}` `personalize()`
  token instead, same rationale as challenger.py.
- `ruff`/`ty`/`prek` all clean.
- **Verified live**: restarted the server, confirmed `/api/status` lists all
  11 agents and no `harvester`. Created a `scaffolder` thread, asked for a
  worker-pool skeleton with named gaps — confirmed real on-persona output
  (named gaps like "L1/L2/L3" failure signatures, refused to hand over the
  core logic) and a genuine `workspace_write` call that created a project
  dir under `workspace/` — reverted before committing (test artifact, not
  real project data, same gotcha class as `WORKING_MEMORY.md` below).
  Second message confirmed clean `"type": "done"` SSE termination and the
  agent correctly self-identifying as "Scaffolder".
- **Bug found during this step, fixed as an immediate follow-up (not by a
  subagent, done directly)**: every agent's `_INSTRUCTIONS` is built via
  `personalize(f"""...{{LEARNER_NAME}}...""")` — an f-string. Python's
  f-string parser collapses `{{` / `}}` to a literal single `{` / `}` *before*
  `personalize()` ever sees the string, so the token that actually reached
  `personalize()` was `{LEARNER_NAME}` (single brace), while
  `learner_profile.py`'s `_TOKEN_VALUES` dict keys are `"{{LEARNER_NAME}}"`
  (double brace). The `.replace()` calls never matched, so
  **personalization had silently never worked** in the Python port — every
  agent's real system prompt contained the literal text `{LEARNER_NAME}` /
  `{COGNITIVE_TAG}` / `{WORK_ROLE}` instead of the learner's actual
  name/tag/role. Affected `tutor.py`, `pair.py`, `challenger.py`,
  `reviewer.py`, `planner.py`, `breaker.py` (the only 6 files that actually
  use these tokens directly in their own f-string body — `assigner.py`,
  `architect.py`, `harvester.py`, `teacher.py`, `scaffolder.py`,
  `researcher.py` never referenced them at all, so nothing to fix there).
  **Fix applied — NOT the single-brace `_TOKEN_VALUES` change floated
  earlier**, because that would have broken a *different*, already-working
  path: `icm.py`'s constants (`INVERTED_PYRAMID_RULES` etc.) are plain
  (non-f) triple-quoted strings containing genuine literal `{{LEARNER_NAME}}`
  double-braces, which get pulled into each agent's f-string via real
  interpolation like `{INVERTED_PYRAMID_RULES}` — f-string escaping only
  collapses `{{`/`}}` written *directly in the f-string's own source*, not
  brace characters arriving through an interpolated variable's value, so
  those tokens were already resolving correctly. Switching `_TOKEN_VALUES`
  to single-brace keys would have fixed the 6 broken files while silently
  breaking that already-correct path. Instead, fixed at the point of
  breakage: in each of the 6 files, every literal `{{LEARNER_NAME}}` /
  `{{COGNITIVE_TAG}}` written directly in an f-string body was escaped to
  quadruple-brace (`{{{{LEARNER_NAME}}}}`), which Python's f-string parser
  collapses to `{{LEARNER_NAME}}` (correct double-brace) by the time
  `personalize()` sees it — matching `_TOKEN_VALUES`'s existing keys
  unchanged. Verified by importing `tutor_os.agents.tutor` directly and
  confirming `_INSTRUCTIONS` contains the real resolved name/tag, not any
  literal brace token. `ruff`/`ty`/`prek` clean on all 6 files.

## Done — `PORT` env var

`server.py`'s `main()` (the `uv run tutor-os-py` entry point) now reads
`port = int(os.environ.get("PORT", "4116"))` instead of hardcoding 4116 —
default unchanged, override via `PORT=<n> uv run tutor-os-py`. The
`uv run uvicorn tutor_os.server:app --port 4116 --reload` dev command
documented in `py/README.md` is unaffected (uvicorn's own `--port` flag
controls that invocation, not `main()`) — added a note there pointing at
the new env var for the packaged-entry-point path. `ruff`/`ty`/`prek`
clean. Live-verified both cases: no `PORT` set → bound 4116 (`curl
/api/status` → 200); `PORT=4117` set → bound 4117, and 4116 correctly
unreachable. Default stays 4116 until the Node-decommission step flips it
to 4115.

## Done — `session.ts`'s `sessionWorkflow` (phase-gate state machine)

Ported the 4-phase Inverted Pyramid gate workflow as a stateless state
machine rather than porting Mastra's step/suspend runtime (pydantic-ai has
no equivalent primitive, and none was needed):

- **New `tools/session.py`**: `PHASES` is a line-for-line port of TS's
  `PHASES` array (kickoff text, expected artifact per phase). `session_start`
  and `session_advance` are the only two functions — both are thin
  orchestration on top of **already-shipped** primitives: `workspace_init`
  (= TS's `ensureProject`) and `phase_set` (= TS's `writePhase`), both in
  `tools/workspace.py`. No new persistence mechanism, no new STATE.md shape
  — the data layer for this was already fully ported before this step even
  started; only the sequencing/suspend logic was missing.
- **HTTP contract, deliberately new — nothing to match**: confirmed
  `sessionWorkflow` is registered in `src/mastra/index.ts` but has **zero**
  callers anywhere — not in `server.ts` (grepped, no route references it),
  not in `ui/index.html`, not in `tutor-os.nvim`. It's only reachable via
  Mastra's own generic auto-exposed workflow-runner API (run-id-based
  create/start/resume), which nothing in this codebase's UI or plugin
  actually calls. So there was no existing contract to preserve — designed
  a clean slug-based one instead: `POST /api/session/start`
  (`{projectSlug, title, objective, stack}` → the phase-1 suspend payload)
  and `POST /api/session/advance` (`{projectSlug, phase, passed, note?}`).
  This consolidates onto Python's single HTTP surface something TS split
  across `server.ts` and Mastra's separate auto-generated API — consistent
  with the "Python is the one and only backend" goal.
- **Suspend semantics**: `passed: false` returns the current phase's gate
  info again (kickoff/expectedArtifact/message) without touching STATE.md —
  matches Mastra's `suspend()`, which only halts execution, doesn't persist.
  `passed: true` on phase < 4 calls `phase_set(..., "concluido", note)` and
  *immediately* returns the suspend payload for the next phase in the same
  response — this is the one real design choice beyond a literal port:
  TS's `.then(phaseNStep)` chaining means resuming phase N's suspend re-enters
  phase N+1's step in the same Mastra run, which immediately suspends again
  since it has no `resumeData` yet. A stateless HTTP API has no notion of
  "the same run" to chain through, so the single `/api/session/advance` call
  does both halves at once (complete N, suspend on N+1) rather than
  requiring two round-trips.
- **Faithfully replicated a TS quirk, not smoothed over**: TS's `finishStep`
  runs unconditionally right after phase 4's gate passes and **overwrites**
  the status `writePhase` just set from `"concluido"` back to
  `"em-andamento"`, with the note `"sessão encerrada — rodar harvest"` — the
  `status` field is doing double duty (phase-4-content-done vs.
  session-fully-closed). Ported exactly: `session_advance` on phase 4 calls
  `phase_set` twice in a row, same as TS's two separate step executions.
  Live-verified this exact final state (see below) rather than assuming a
  single `phase_set(..., "concluido")` call would suffice.
- **Verified live, full 4-phase run** against a real project via curl:
  `session/start` → phase-1 suspend; `advance(phase=1, passed=false)` →
  confirmed STATE.md unchanged (still `fase: 1`); `advance(phase=1,
  passed=true)` → confirmed STATE.md flipped to `status: concluido` and the
  response correctly suspended on phase 2; advanced through phases 2 and 3;
  `advance(phase=4, passed=true)` → confirmed the final STATE.md matches the
  TS quirk exactly (`fase: 4`, `status: em-andamento`, log has both the
  phase-4 gate note and the "sessão encerrada" note) and the response
  returned `{finished: true, summary: "...Chame o Harvester."}`. Deleted the
  test project directory before committing (test-generated runtime state,
  same gotcha as `WORKING_MEMORY.md`/test project dirs in prior steps).
- `ruff`/`ty`/`prek` all clean. One `PLR2004` (magic value `4` in a phase
  comparison) fixed by naming it `_FINAL_PHASE = 4`.

## Done — Tauri/launch config cutover

`src-tauri/tauri.conf.json`'s `beforeDevCommand` now runs
`cd py && PORT=4115 uv run tutor-os-py` instead of `npm run serve`. Used an
explicit `PORT=4115` override rather than changing `server.py`'s coded
default (still 4116) — `devUrl`/`app.windows[0].url` are hardcoded to
`http://localhost:4115`, so the dev-launch command has to hit that port,
but the default stays 4116 until the Node-decommission step actually flips
it (per the "Migration gotchas" port note below). Verified by running the
exact `beforeDevCommand` string standalone and confirming `/api/status`
answers on :4115.

**Deliberately left untouched**: root `package.json`'s `serve`/`start`
scripts still run the Node backend (`tsx src/server.ts`) — Node hasn't
been decommissioned yet, so removing or repointing them now would silently
orphan a working entry point rather than cleanly retiring it. That
cleanup belongs to the decommission step below, alongside the rest of
`package.json`'s trim.

## Done — Node backend decommissioned (Python is the only backend)

**User explicitly signed off on this destructive step.** Verified
Python-only worked on port 4115 (the way Tauri now launches it) *before*
deleting anything, then:

- **`git rm -r src/mastra src/server.ts src/mcp.ts`** — the entire Node/
  Mastra backend (33 files: all agents, tools, `memory.ts`, `mcp.ts`,
  `workflows/session.ts`, `index.ts`, `storage.ts`). `src/` no longer
  exists (git drops the now-empty directory).
- **`git rm tsconfig.json`** too — its only `include` target was
  `src/**/*.ts`, so it became dead the moment `src/` was gone. Not
  explicitly named in the original TODO wording but squarely in scope
  (Node-backend build config, not a Tauri/`ui/` asset).
- **`package.json` trimmed**: emptied `dependencies` entirely
  (`@ai-sdk/openai`, `@mastra/*`, `duck-duck-scrape`, `fast-xml-parser`,
  `zod` — all were imported only from the now-deleted `src/` tree, verified
  before removal). `devDependencies` reduced to just `@tauri-apps/api` +
  `@tauri-apps/cli` — `mastra`, `tsx`, `typescript`, `@types/node` were only
  needed to run/type-check the deleted TS backend (confirmed via
  `tauri.conf.json`'s `frontendDist: "../ui"` — Tauri serves the static
  `ui/` folder directly, no bundler, no TS build step in the frontend path
  at all). Scripts trimmed to just `app`/`tauri`; `dev`, `serve`, `start`,
  `mcp`, `build` removed (all pointed at now-deleted files). Ran
  `npm install` to regenerate `package-lock.json` against the trimmed
  manifest — succeeded clean, 3 packages, 0 vulnerabilities.
- **`server.py`'s default port flipped 4116 → 4115** (`os.environ.get
  ("PORT", "4115")`) now that Node no longer owns 4115. `py/README.md`
  updated to match and to drop the "coexists with Node" framing.
- **Root `README.md`**: rewrote the "Rodar" (run) section to point at
  `uv run tutor-os-py` / `py/README.md`; added a note atop the doc that the
  Architecture/Memory/Workflow sections below describe the *original*
  Mastra design (kept for background, not rewritten line-by-line for
  Python) and that `py/NEXT-PHASES.md` is the live migration record. A full
  rewrite of those sections to Python-native terms was judged out of scope
  for this step — flagging here in case a future pass wants to do it
  properly rather than leaving it silently stale.
- **Verified live, in this order**: (1) pre-deletion, Python bound 4115 and
  answered `/api/status`, `/api/threads`, `/api/arcs`; confirmed
  `tutor-os.nvim/lua/tutor/api.lua` hardcodes `http://localhost:4115`
  generically, no Node-specific behavior to lose; (2) post-deletion,
  `ruff`/`ty`/`prek` clean on `server.py`, import smoke test clean; (3)
  restarted with **no** `PORT` env var set — bound 4115 by default (not
  4116), confirming the flip actually took effect, not just the env-var
  override path.
- **`@tauri-apps/api` note**: `ui/index.html` uses the injected
  `window.__TAURI__` global (`withGlobalTauri: true` in
  `tauri.conf.json`), not an import from the `@tauri-apps/api` npm
  package — that package may be fully unused too, but wasn't touched here
  since it's Tauri/frontend tooling, not part of the Node-backend deletion
  this step scoped to.

**Genuinely still deferred (not part of "Python is the only backend",
separate user decision)** — **Python MCP server**: nothing in this
codebase depends on it (nvim plugin and UI are both plain HTTP; MCP only
matters for external clients like Claude Desktop/Cursor/Windsurf, not in
active use here). If picked up later: new `py/src/tutor_os/mcp_server.py`
(stdio transport, official `mcp` Python SDK), the ~23 direct tools already
ported, `ask_<agent>` for all 11 wired agents plus `ask_harvester`, and the
session workflow (`tools/session.py`, already real).

**Definition of done: Python is the only backend**
- [x] `uv run tutor-os-py` is the only thing needed to run the backend —
      no `npm run serve`/`start`/`mcp` exist anymore (`npm run mcp` was
      never built for Python, intentionally deferred above).
- [ ] `ui/index.html` works fully against Python-only on port 4115 — port
      flip verified via `/api/status`; a full UI click-through smoke test
      hasn't been re-run since this step, worth doing next time the UI is
      exercised live.
- [x] `tutor-os.nvim` works unchanged — confirmed hardcoded to
      `http://localhost:4115` generically, verified reachable before and
      after this step.
- [x] `src-tauri`'s dev/build flow launches Python, not Node — see "Done —
      Tauri/launch config cutover" above; `beforeDevCommand` already used
      `PORT=4115` explicitly, unaffected by the default-port flip.
- [x] `src/`, `src/mastra/`, `src/mcp.ts` deleted; `package.json` trimmed;
      `tsconfig.json` removed as a consequence.

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
- **`personalize()` tokens must never be written as literal `{{TOKEN}}` inside
  an f-string body** — Python's f-string parser collapses `{{`/`}}` to a
  single `{`/`}` before `personalize()` ever sees the string, so the
  `.replace("{{LEARNER_NAME}}", ...)` lookup silently never matches (this
  broke personalization across the whole agent roster for several batches
  before being caught — see "Done — standalone planner, scaffolder, breaker
  agents" above for the full writeup). If a new agent file's f-string needs
  `{{LEARNER_NAME}}`/`{{COGNITIVE_TAG}}`/`{{WORK_ROLE}}` written directly in
  its own template text, write it as quadruple-brace
  (`{{{{LEARNER_NAME}}}}`) so it survives collapsing as literal double-brace.
  This does NOT apply to tokens arriving via a real interpolated variable
  (e.g. `icm.py`'s `{INVERTED_PYRAMID_RULES}`, whose *value* already
  contains genuine double braces from a plain, non-f string) — those already
  work correctly and must not be "fixed" the same way.
