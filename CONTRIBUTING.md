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

Install the commit hook once, and the checks below run on every commit:

```bash
prek install     # or: pre-commit install
```

## Before opening a PR

Run from `backend/`:

```bash
uv run ruff check .
uv run ruff format .
uvx ty check --project .
uv run pytest -q
uv lock --check          # if you touched dependencies
```

CI (`.github/workflows/ci.yml`) runs the same checks.

## Tests

Everything in `backend/tests/` is deterministic and offline — no API key, no
network. Agent wiring is exercised against pydantic-ai's `TestModel` /
`FunctionModel`.

| File | Guards |
|---|---|
| `test_tool_contract.py` | The tool schemas the model actually receives |
| `test_agent_behavior.py` | Registry integrity, working-memory injection, tool reachability |
| `test_memory.py` | All four memory layers, round-tripped |
| `test_security.py` | Path containment on agent-supplied paths |
| `test_api.py` | HTTP shapes and the `{"error": ...}` envelope |

**When `test_tool_contract.py` fails**, a tool's LLM-facing schema moved.
Docstrings in `tools/` are sent to the model verbatim — the summary becomes the
tool description and each `Args:` entry becomes a parameter description — so
rewording one changes agent behavior. Read the diff; if it was deliberate:

```bash
UPDATE_SNAPSHOTS=1 uv run pytest tests/test_tool_contract.py
```

and commit the updated snapshot so the change is visible in review.

### LLM evals

`tests/test_llm_evals.py` checks behavior that only a real model can
demonstrate — that the Tutor orients itself instead of asking "where did we
leave off", that it never ends a turn in silence, that tool use stays
economical. These cost tokens and are non-deterministic, so they are
deselected by default and never run in CI or on commit:

```bash
uv run pytest -m llm
```

Run them when you change an agent's instructions or `prompts/icm.py`. That is
the change the deterministic suite cannot judge.

`pyproject.toml`'s `[tool.ruff.lint.per-file-ignores]` carries complexity
exceptions for `tools/research.py` and `tools/page_index.py` — accepted
backlog, not a template to copy. If you're touching one of those functions
for real, fix the complexity instead of adding to the ignore list.

## Adding a new agent

**First decide whether it should be an agent at all.** A persona that runs an
autonomous multi-step tool loop is an agent. A single prompt-shaped behavior
with no tool loop belongs in `backend/.agents/skills/<name>/SKILL.md`, loaded
into the Tutor's context via `load_capability` — cheaper, and it keeps the
conversation history that delegation would drop. See
[ADR 0002](docs/adr/0002-a2a-delegation-and-skills.md).

If it really is an agent:

1. Add `agents/<name>.py` following an existing one (e.g. `agents/pair.py`).
   Name the module-level agent exactly `agent`, and call
   `agent.instructions(inject_working_memory)` right after construction so it
   picks up the shared working-memory system.
2. Export `TOOL_FUNCTIONS`, then add the module to `_AGENT_MODULES` in
   `server.py` — `AGENTS` and `_AGENT_TOOL_FUNCTIONS` derive from it.
3. If the instructions interpolate a `{{TOKEN}}` placeholder directly inside
   an f-string body, write it as quadruple-brace (`{{{{LEARNER_NAME}}}}`).
   Python's f-string parser collapses `{{`/`}}` to a single literal brace
   before `personalize()` ever sees the string, so the double-brace form
   silently never matches. Fragments imported from `prompts/icm.py` are
   unaffected — escaping only applies to braces written in the f-string's own
   source.

## Reporting issues

Open a GitHub issue with repro steps.
