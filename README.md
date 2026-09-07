# Tutor OS

A learning system for engineers who are past tutorials and want technical
judgment instead. It runs a single Tutor agent over a persistent, auditable
memory of what you have actually built and proven.

The core claim it enforces: **a capability counts as learned only when it
traces back to reproducible evidence.** Not "I read about WAL" — a benchmark,
a metric, and the command to run it again.

## How it works

Projects run through four phases (the Inverted Pyramid), each with a gate you
have to pass by hand:

1. **Macro topology** — map the invariants on paper.
2. **Tracer bullet** — smallest end-to-end thing that runs.
3. **Break edges** — make it fail on purpose, at the edges.
4. **Architecture note** — one page: invariants, when not to use, hidden traps.

What you extract along the way lands in a four-layer memory: a working profile
injected into every call, append-only session episodes, an auditable evidence
graph behind a skill map, and per-project workspaces. See
[ADR 0003](docs/adr/0003-multi-layer-memory.md).

## Run it

```bash
cd backend
uv sync
cp .env.example .env   # add a model gateway key
uv run uvicorn tutor_os.server:app --port 4115 --reload
```

Then open <http://localhost:4115>. Requires Python 3.12+ and
[uv](https://docs.astral.sh/uv/).

## Layout

| Path | What |
|---|---|
| `backend/` | FastAPI server, agents, tools, memory ([README](backend/README.md)) |
| `frontend/` | Static UI — no build step |
| `desktop/` | Tauri 2 shell that manages the backend process |
| `workspace/` | Your projects and memory files, on disk and readable |
| `docs/adr/` | Why things are the way they are |

## Decisions

- [0001 — pydantic-ai as the agent runtime](docs/adr/0001-pydantic-ai-as-agent-runtime.md)
- [0002 — A2A delegation and Skills](docs/adr/0002-a2a-delegation-and-skills.md)
- [0003 — Multi-layer memory](docs/adr/0003-multi-layer-memory.md)
- [0004 — Tauri over Electron](docs/adr/0004-tauri-over-electron.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed.
