# Tutor OS

A few months ago I spent an evening pair programming with an LLM on an LSM-tree storage engine. The code was tidy, the tests passed, and by Monday morning I realized I could not explain how the compaction tombstone logic worked without pulling up git log.

The assistant had done its job well: it autocompleted the hard parts and got me to green. But I had not learned how LSM compaction behaves under write pressure. I was just the paste buffer.

Tutor OS started out of frustration with that loop. It is a local tutor that runs over your workspace, but with a deliberate rule: it refuses to write the code that matters, and it will not mark something as learned just because you nodded along in chat.

The invariant it enforces: **a capability only counts as learned when it traces back to reproducible evidence.** Not "I read the Postgres WAL documentation", but a benchmark, a test, a reproduction command, and an artifact on disk.

## How it works

Projects move through four phases before anything gets checked off:

1. **Macro topology on paper.** Sketch the invariants and data flow before opening an editor. If you cannot explain the failure modes on an index card, generating code only hides the confusion.
2. **Tracer bullet.** The smallest possible end-to-end slice that compiles and runs. The tutor provides the boundary skeleton with named gaps; you write the actual logic.
3. **Break edges.** Intentionally break it. Fuzz boundary conditions, trigger race conditions, cut network connections.
4. **Architecture note.** One page: the invariants, when not to use this design, and what broke along the way.

What comes out of this lands in a four-layer memory on disk:
- `WORKING_MEMORY.md` — a Markdown profile injected fresh into every model call.
- `EPISODES.jsonl` — append-only session records (what broke, what was extracted).
- `ARCS.json` & `EVIDENCES.json` — the skill map and the verified reproduction commands backing it.
- `workspace/<slug>/` — project-specific artifacts, alongside SQLite for conversation thread history.

## What I got wrong building this

### The multi-agent trap
My first pass had an agent for everything: Teacher, Challenger, Reviewer, Scaffolder, Breaker, Assigner, Researcher. Every persona was a separate `Agent` object invoked over agent-to-agent delegation.

It was a mess.

Delegating to a separate agent means a stateless round trip. The callee gets whatever prompt you hand it and nothing else. It cannot see the conversation. When the Teacher was invoked to explain a confusing error from two messages earlier, it had no context and defaulted to textbook definitions.

The fix was splitting personas by one question: *does this persona run a noisy multi-step tool loop?*
- If yes (like `researcher` crawling docs or arXiv papers), it gets an isolated agent so its tool output does not wreck the main context.
- If no (like `challenger` or `breaker`), it is a **Skill** loaded directly into the Tutor's active turn. The Tutor stays in-character, keeps the full thread history, and does not pay for an extra round trip.

See [ADR 0002](docs/adr/0002-a2a-delegation-and-skills.md).

### Files over vector databases
I started without a vector database, thought I would need one soon, and never did.

For a single engineer's working memory, vector search is usually the wrong tool. When an agent hallucinates something into your profile, you want to open a file in your editor, delete the bad paragraph, and save. Markdown and JSON files are diffable in git, greppable, and inspectable. SQLite is reserved for chat threads and raw tool event streams, where write volume and row ordering actually matter.

See [ADR 0003](docs/adr/0003-multi-layer-memory.md).

## Quick start

### Backend (Web UI)

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/).

```bash
cd backend
uv sync
cp .env.example .env
```

Add your API key to `.env` (`OPENCODE_API_KEY` or `OPENAI_API_KEY`). There is no dotenv auto-loader wired in, so export it into your environment:

```bash
export $(cat .env | xargs)
uv run uvicorn tutor_os.server:app --port 4115 --reload
```

Open <http://localhost:4115>. The frontend is plain static HTML/CSS/JS served directly by FastAPI — no bundler, no node_modules, no build step.

### Desktop shell (Tauri 2)

If you prefer a native window, there is a Tauri 2 shell that spawns and manages the backend process for you. Requires [Rust and Cargo](https://rustup.rs/).

```bash
cd desktop/src-tauri
cargo tauri dev
```

We picked Tauri over Electron because Electron would have meant shipping Chromium and Node just to wrap a Python process and static HTML (see [ADR 0004](docs/adr/0004-tauri-over-electron.md)).

## Project layout

| Path | What it does |
|---|---|
| `backend/` | FastAPI server, pydantic-ai agents, tools, memory ([README](backend/README.md)) |
| `frontend/` | Static UI (served by backend, no build step) |
| `desktop/` | Tauri 2 desktop shell in Rust |
| `workspace/` | Local project workspaces and memory files on disk |
| `docs/adr/` | Architectural decisions and why they were made |

## Decisions (ADRs)

- [0001 — pydantic-ai as the agent runtime](docs/adr/0001-pydantic-ai-as-agent-runtime.md)
- [0002 — A2A delegation and Skills](docs/adr/0002-a2a-delegation-and-skills.md)
- [0003 — Multi-layer memory](docs/adr/0003-multi-layer-memory.md)
- [0004 — Tauri over Electron](docs/adr/0004-tauri-over-electron.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for test instructions and guidelines on adding tools or skills. MIT licensed.
