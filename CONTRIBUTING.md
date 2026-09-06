# Contributing

## Setup

```bash
cd backend
uv sync
cp .env.example .env   # fill in a model gateway key
uv run uvicorn tutor_os.server:app --port 4115 --reload
```

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/). Don't `pip
install` into a bare interpreter — everything goes through `uv` so the lock
file (`backend/uv.lock`) stays authoritative.

## Before opening a PR

Run from `backend/`:

```bash
uv run ruff check .
uv run ruff format .
uvx ty check --project .
uv lock --check          # if you touched dependencies
uv run python -c "import tutor_os.server"   # import smoke test
```

CI (`.github/workflows/ci.yml`) runs the same four checks — a red one there
means one of these was skipped locally.

`pyproject.toml`'s `[tool.ruff.lint.per-file-ignores]` carries a short list
of pre-existing complexity/magic-value exceptions in `tools/research.py`,
`tools/page_index.py`, `tools/meta.py`, `tools/gate.py` — accepted backlog,
not a template to copy. If you're touching one of those functions for real,
fix the underlying complexity instead of adding to the ignore list.

## Adding a new agent

1. Add `agents/<name>.py` following an existing one (e.g. `agents/pair.py`)
   — build the `Agent`, call `<agent>.instructions(inject_working_memory)`
   right after construction so it picks up the shared working-memory system.
2. Register it in `server.py`'s `AGENTS` and `_AGENT_TOOL_FUNCTIONS` dicts.
3. If the agent's instructions interpolate a `{{TOKEN}}`-style personalize()
   placeholder directly inside an f-string body, write it as quadruple-brace
   (`{{{{LEARNER_NAME}}}}`) — Python's f-string parser collapses `{{`/`}}`
   to a literal single brace before `personalize()` ever sees the string, so
   the double-brace form silently never matches. See `backend/NEXT-PHASES.md`'s
   "Migration gotchas" for the full writeup of a bug this caused.
4. A single-prompt persona with no autonomous tool loop of its own is
   usually a better fit as a **Skill** (`backend/.agents/skills/<name>/SKILL.md`,
   loaded into the Tutor's context via `load_capability`) than a full
   `Agent` — see `backend/README.md`'s "Agents vs. Skills" section for the
   criteria.

## Reporting issues

Open a GitHub issue with repro steps.
