# backend

FastAPI + pydantic-ai. Serves the HTTP/SSE API and the static `frontend/`.

## Run

```bash
uv run uvicorn tutor_os.server:app --port 4115 --reload
```

Or the packaged entry point, which reads `PORT` (default `4115`):

```bash
PORT=4117 uv run tutor-os-py
```

Copy `.env.example` to `.env` and set a model gateway key —
`OPENCODE_API_KEY` / `OPENCODE_BASE_URL`, or the `OPENAI_*` equivalents.
There is no dotenv loader wired in, so export it yourself:
`export $(cat .env | xargs)`.

Set `TUTOR_OS_ROOT` to point at the repo root when running from anywhere
other than `backend/`'s parent.

## Layout

| Path | What |
|---|---|
| `server.py` | Routes, SSE chat loop, error handlers |
| `agents/` | One module per agent; each exports `agent` and `TOOL_FUNCTIONS` |
| `tools/` | Agent tools — plain functions, also called directly by `server.py` |
| `prompts/icm.py` | Instruction fragments shared across agents |
| `storage.py` | Filesystem roots, JSON/text helpers, SQLite connection |
| `db.py` | Threads, messages, tool events |
| `markdown.py` | Section-scoped editing of the Markdown memory docs |
| `.agents/skills/` | Skill definitions loaded into the Tutor's context |

## Things worth knowing before editing

**Tool docstrings are the LLM-facing schema.** In `tools/`, a function's
docstring becomes the tool description and its `Args:` entries become the
per-parameter descriptions the model reads. Rewriting one for style changes
agent behavior. This is the one place where long prose is correct.

**Agents are registered by module.** `server.py` builds `AGENTS` and
`_AGENT_TOOL_FUNCTIONS` from `_AGENT_MODULES`, so each agent module must
export exactly `agent` and `TOOL_FUNCTIONS`.

**Handlers raise; they do not return error responses.** Two exception
handlers in `server.py` convert anything that escapes into the
`{"error": ...}` shape the frontend reads. Use `_required(payload, "key")`
for missing-field validation.

**Memory files are written through `storage.py`.** `write_text`, `write_json`
and `append_jsonl` handle directory creation and encoding — don't hand-roll
`path.write_text(..., encoding="utf-8")` again.

See [`docs/adr/`](../docs/adr/) for why the architecture looks like this.
