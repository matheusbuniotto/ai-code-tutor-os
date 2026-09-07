"""HTTP API and SSE chat loop.

Endpoints are grouped by panel (status, config, chat, research, threads,
workspace, memory, arcs). Handlers raise; the two exception handlers below
turn anything that escapes into the `{"error": ...}` shape the frontend reads.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import mimetypes
import os
from datetime import UTC, datetime, timedelta
from typing import Any, NamedTuple

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic_ai import (
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    PartStartEvent,
    RetryPromptPart,
    TextPart,
    TextPartDelta,
)
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    UserPromptPart,
)

from tutor_os import db
from tutor_os.agents import (
    architect,
    assigner,
    breaker,
    challenger,
    pair,
    planner,
    researcher,
    reviewer,
    scaffolder,
    teacher,
    tutor,
)
from tutor_os.config.learner_profile import read_learner_profile, write_learner_profile
from tutor_os.model import (
    get_active_model_name,
    get_model,
    get_runtime_config,
    update_runtime_config,
)
from tutor_os.storage import PROJECT_ROOT, WORKSPACE_ROOT, init_db
from tutor_os.tools.arcs import read_arcs_data, save_arcs_data
from tutor_os.tools.episodes import episodes_clear, episodes_delete, episodes_recent
from tutor_os.tools.living_library import library_index
from tutor_os.tools.memory_audit import (
    L2Evidence,
    evidence_list,
    get_full_memory_graph,
    link_capability,
    read_evidences,
    short_id,
    write_evidences,
)
from tutor_os.tools.meta import meta_overview, meta_set_now
from tutor_os.tools.observations import (
    observation_capture,
    observation_delete,
    observation_update,
    observations_reset,
    read_observations,
)
from tutor_os.tools.os_files import os_read
from tutor_os.tools.page_index import paper_dissect, read_dissected_papers
from tutor_os.tools.rescue import rescue_diagnose
from tutor_os.tools.research import arxiv_search, web_search
from tutor_os.tools.session import session_advance, session_start
from tutor_os.tools.state import state_read
from tutor_os.tools.workspace import (
    workspace_archive,
    workspace_delete,
    workspace_init,
    workspace_list,
    workspace_read,
    workspace_write,
)

logger = logging.getLogger("tutor_os")

UI_DIR = PROJECT_ROOT / "frontend"

_AGENT_MODULES = {
    m.__name__.rsplit(".", 1)[-1]: m
    for m in (
        tutor,
        assigner,
        researcher,
        pair,
        architect,
        challenger,
        reviewer,
        teacher,
        planner,
        scaffolder,
        breaker,
    )
}
AGENTS = {name: mod.agent for name, mod in _AGENT_MODULES.items()}
_AGENT_TOOL_FUNCTIONS = {name: mod.TOOL_FUNCTIONS for name, mod in _AGENT_MODULES.items()}
_AUTO_COMPACT_KEEP_LAST = 16

init_db()

app = FastAPI(title="Tutor OS (Python)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS", "DELETE"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("%s %s failed", request.method, request.url.path)
    return JSONResponse({"error": str(exc)}, status_code=500)


@app.exception_handler(HTTPException)
def http_error(request: Request, exc: HTTPException) -> JSONResponse:
    """Keeps the `{"error": ...}` shape the frontend reads, instead of FastAPI's `detail`."""
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


def _required(payload: dict, *keys: str) -> list:
    missing = [k for k in keys if not payload.get(k)]
    if missing:
        raise HTTPException(400, f"{' and '.join(missing)} required")
    return [payload[k] for k in keys]


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# pydantic-ai-harness always names a Skill invocation "load_capability" and
# passes the actual skill id (e.g. "challenger") as an argument — without this,
# every Skill call is indistinguishable from a generic tool call in the UI.
_SKILL_LOADER_TOOL_NAME = "load_capability"


def _skill_id_from_args(tool_name: str, args: dict) -> str | None:
    if tool_name == _SKILL_LOADER_TOOL_NAME:
        return args.get("id") or args.get("capability") or args.get("name")
    return None


class _ChatTurn(NamedTuple):
    """Identifies the thread/agent/turn a live SSE stream belongs to, so it can
    be threaded through as a single parameter instead of three positional
    ones (keeps _consume_agent_stream under the project's max-args limit)."""

    thread_id: str
    agent_id: str
    turn_id: str


def _stream_event_frames(event: Any, full_text_parts: list[str], turn: _ChatTurn):
    """Translate one pydantic-ai stream event into zero or more SSE frames.

    Appends any streamed text to `full_text_parts` (used to persist the full
    assistant reply once the stream ends) and yields the matching SSE payload(s).
    Also persists tool-call/tool-result/tool-error events to `db.tool_events`
    as they happen, so A2A delegation and Skill invocations survive a page
    reload instead of only existing in the live DOM for that one session.
    """
    if (
        isinstance(event, PartStartEvent)
        and isinstance(event.part, TextPart)
        and event.part.content
    ):
        full_text_parts.append(event.part.content)
        yield _sse({"type": "text", "text": event.part.content})
    elif (
        isinstance(event, PartDeltaEvent)
        and isinstance(event.delta, TextPartDelta)
        and event.delta.content_delta
    ):
        full_text_parts.append(event.delta.content_delta)
        yield _sse({"type": "text", "text": event.delta.content_delta})
    elif isinstance(event, FunctionToolCallEvent):
        args = event.part.args_as_dict()
        skill_id = _skill_id_from_args(event.part.tool_name, args)
        db.save_tool_call(
            turn.thread_id,
            turn.turn_id,
            event.part.tool_call_id,
            event.part.tool_name,
            skill_id,
            json.dumps(args, default=str),
        )
        yield _sse({
            "type": "tool-call",
            "toolCallId": event.part.tool_call_id,
            "toolName": event.part.tool_name,
            "skillId": skill_id,
            "args": args,
        })
    elif isinstance(event, FunctionToolResultEvent):
        part = event.part
        if isinstance(part, RetryPromptPart):
            error_text = (
                part.content
                if isinstance(part.content, str)
                else json.dumps(part.content, default=str)
            )
            db.save_tool_result(part.tool_call_id, json.dumps(error_text), True)
            yield _sse({
                "type": "tool-error",
                "toolCallId": part.tool_call_id,
                "toolName": part.tool_name or "tool",
                "error": error_text,
            })
        else:
            db.save_tool_result(part.tool_call_id, json.dumps(part.content, default=str), False)
            yield _sse({
                "type": "tool-result",
                "toolCallId": part.tool_call_id,
                "toolName": part.tool_name,
                "result": part.content,
                "isError": False,
            })


async def _produce_agent_events(
    agent: Any,
    message: str,
    message_history: list[ModelMessage],
    model: Any,
    queue: asyncio.Queue[Any],
    done_marker: object,
) -> None:
    """Run the agent's streaming call, forwarding each event onto `queue`.

    Runs as its own asyncio.Task (see `event_source`) so a client disconnect can
    genuinely cancel the in-flight LLM/tool call via Task.cancel(), instead of
    merely halting consumption of its output while it keeps running unseen.
    """
    try:
        async with agent.run_stream_events(
            message, message_history=message_history, model=model
        ) as events:
            async for event in events:
                await queue.put(event)
    except asyncio.CancelledError:
        pass
    except Exception as err:
        await queue.put(err)
    finally:
        await queue.put(done_marker)


async def _watch_disconnect(request: Request, disconnected: asyncio.Event) -> None:
    while not disconnected.is_set():
        if await request.is_disconnected():
            disconnected.set()
            return
        await asyncio.sleep(0.5)


async def _consume_agent_stream(
    queue: asyncio.Queue[Any],
    done_marker: object,
    disconnected: asyncio.Event,
    full_text_parts: list[str],
    turn: _ChatTurn,
):
    """Drain `queue`, yielding SSE frames, until the producer finishes or the
    client disconnects."""
    while True:
        if disconnected.is_set():
            return
        try:
            item = await asyncio.wait_for(queue.get(), timeout=0.5)
        except TimeoutError:
            continue

        if item is done_marker:
            return
        if isinstance(item, Exception):
            logger.exception(
                "chat run failed (thread=%s agent=%s)",
                turn.thread_id,
                turn.agent_id,
                exc_info=item,
            )
            yield _sse({"type": "error", "error": str(item)})
            return

        for frame in _stream_event_frames(item, full_text_parts, turn):
            yield frame


def _history_to_model_messages(messages: list[dict]) -> list[ModelMessage]:
    result: list[ModelMessage] = []
    for m in messages:
        if m["role"] == "user":
            result.append(ModelRequest(parts=[UserPromptPart(content=m["content"])]))
        else:
            result.append(ModelResponse(parts=[TextPart(content=m["content"])]))
    return result


_TITLE_PREVIEW_LENGTH = 42


def _preview_title(message: str) -> str:
    preview = message[:_TITLE_PREVIEW_LENGTH].replace("\n", " ").replace("\r", " ")
    return preview + ("..." if len(message) > _TITLE_PREVIEW_LENGTH else "")


# ---------------------------------------------------------------------------
# 1. Status & config
# ---------------------------------------------------------------------------


@app.get("/api/status")
async def api_status() -> dict:
    agents_list = [
        {
            "id": aid,
            "name": agent.name or aid,
            "tools": [fn.__name__ for fn in _AGENT_TOOL_FUNCTIONS[aid]],
        }
        for aid, agent in AGENTS.items()
    ]
    return {
        "status": "online",
        "model": get_active_model_name(),
        "config": get_runtime_config(),
        "agents": agents_list,
    }


@app.get("/api/config")
async def get_config() -> dict:
    return {"ok": True, **get_runtime_config()}


@app.post("/api/config")
async def post_config(request: Request) -> dict:
    payload = await request.json()
    updated = update_runtime_config(**{
        k: payload.get(k) for k in ("model", "base_url", "api_key") if k in payload
    })
    return {"ok": True, "config": updated}


@app.get("/api/config/learner-profile")
async def get_learner_profile() -> dict:
    from dataclasses import asdict

    return {"ok": True, "profile": asdict(read_learner_profile())}


@app.post("/api/config/learner-profile")
async def post_learner_profile(request: Request) -> dict:
    from dataclasses import asdict

    payload = await request.json()
    profile = write_learner_profile(payload)
    return {
        "ok": True,
        "profile": asdict(profile),
        "note": "Restart the server to apply this to the agents' instructions.",
    }


# ---------------------------------------------------------------------------
# 2. Chat (SSE streaming + JSON RPC)
# ---------------------------------------------------------------------------


@app.post("/api/chat")
@app.post("/api/generate")
async def chat(request: Request) -> Any:
    payload = await request.json()
    message: str = payload.get("message", "")
    agent_id = payload.get("agentId", "tutor")
    thread_id = payload.get("threadId") or db.new_id("thread")
    is_stream = payload.get("stream", True) and request.url.path != "/api/generate"

    agent = AGENTS.get(agent_id) or AGENTS["tutor"]

    existing_thread = db.get_thread(thread_id)
    title = (
        _preview_title(message)
        if not existing_thread
        or existing_thread["title"]
        # Old Portuguese defaults kept alongside the new English ones so
        # already-existing threads (titled before this i18n pass) still get
        # auto-renamed from their first message instead of looking "stuck".
        in (None, "", "Nova Sessão", "Sessão Principal", "New Session", "Main Session")
        else existing_thread["title"]
    )
    db.upsert_thread(thread_id, title, agent_id)

    raw_history = db.list_messages(thread_id)[-db.LAST_MESSAGES :]
    message_history = _history_to_model_messages(raw_history)
    model = get_model()

    if not is_stream:
        result = await agent.run(message, message_history=message_history, model=model)
        text = result.output or ""
        db.save_message(thread_id, "user", message)
        db.save_message(thread_id, "assistant", text)
        db.touch_thread(thread_id)
        return {"ok": True, "text": text, "threadId": thread_id, "agentId": agent_id}

    async def event_source():
        # The agent runs as its own task feeding a queue, so a client disconnect
        # can cancel the in-flight LLM/tool call outright rather than just
        # dropping what we forward to a dead connection.
        full_text_parts: list[str] = []
        queue: asyncio.Queue[Any] = asyncio.Queue()
        done_marker = object()
        disconnected = asyncio.Event()
        turn = _ChatTurn(thread_id, agent_id, db.new_id("turn"))

        producer = asyncio.create_task(
            _produce_agent_events(agent, message, message_history, model, queue, done_marker)
        )
        watcher = asyncio.create_task(_watch_disconnect(request, disconnected))

        try:
            async for frame in _consume_agent_stream(
                queue, done_marker, disconnected, full_text_parts, turn
            ):
                yield frame
        finally:
            # Disconnect (or an early break) cancels the producer task, which really
            # tears down the in-flight agent.run_stream_events() call/tool chain —
            # not merely stops forwarding its output.
            watcher.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await watcher
            if not producer.done():
                producer.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await producer

        full_text = "".join(full_text_parts).strip()
        user_message_id = ""
        assistant_message_id = ""
        if message.strip():
            user_message_id = db.save_message(thread_id, "user", message.strip())
        if full_text:
            assistant_message_id = db.save_message(thread_id, "assistant", full_text)
        if assistant_message_id:
            db.set_tool_events_message_id(turn.turn_id, assistant_message_id)
        db.touch_thread(thread_id)

        if disconnected.is_set():
            # Client is gone (Stop button / tab close) — mirrors server.ts's
            # `if (!res.writableEnded)` guard: persist what was generated so far
            # and end quietly instead of writing to a dead connection.
            return

        yield _sse({
            "type": "done",
            "stopped": False,
            "userMessageId": user_message_id,
            "assistantMessageId": assistant_message_id,
            "compacted": False,
            "compactedCount": 0,
            "compactedSummary": "",
        })

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


# ---------------------------------------------------------------------------
# 3. Research panel (arXiv/web search, paper dissection, evidence export)
# ---------------------------------------------------------------------------


@app.post("/api/research")
async def api_research(request: Request) -> Any:
    payload = await request.json()
    mode = payload.get("mode") or "arxiv"
    if mode == "web":
        return await web_search(
            payload.get("query") or "rust concurrency atomics",
            source=payload.get("source") or "all",
            max_results=payload.get("maxResults") or 6,
        )
    return await arxiv_search(
        payload.get("query") or "system design storage",
        max_results=payload.get("maxResults") or 10,
        sort_by=payload.get("sortBy") or "relevance",
        search_field=payload.get("searchField") or "all",
    )


@app.get("/api/research/dissections")
async def api_research_dissections() -> Any:
    papers = read_dissected_papers()
    return {"ok": True, "dissections": papers}


@app.post("/api/research/dissect")
async def api_research_dissect(request: Request) -> Any:
    payload = await request.json()
    return await paper_dissect(
        payload.get("url")
        or payload.get("arxivId")
        or payload.get("paperUrlOrId")
        or "system-design",
        title_hint=payload.get("title") or payload.get("titleHint") or "",
        abstract_hint=payload.get("abstract") or payload.get("abstractHint") or "",
    )


@app.post("/api/research/export-evidence")
async def api_research_export_evidence(request: Request) -> Any:
    payload = await request.json()
    evidences = read_evidences()
    new_id = payload.get("id") or f"ev-paper-{datetime.now(UTC).strftime('%f')[-4:]}"
    new_evidence: L2Evidence = {
        "id": new_id,
        "claim": payload.get("claim") or "Empirical claim extracted from the academic literature.",
        "metric": payload.get("metric") or "Theoretical Validation and Benchmark",
        "surface": payload.get("surface") or "benchmark",
        "sourceRef": payload.get("sourceRef") or payload.get("url") or "arXiv Academic Literature",
        "sourceL1Id": payload.get("sourceL1Id") or "ep-paper-ref",
        "arcId": payload.get("arcId") or "arc1_behavior",
        "capabilityId": payload.get("capabilityId"),
        "reproductionCommand": payload.get("reproductionCommand"),
        "verifiedBy": "reviewer",
        "confidence": 1.0,
        "verifiedAt": datetime.now(UTC).isoformat(),
        "notes": f"Surgical Citation: {payload['surgicalCitation']}"
        if payload.get("surgicalCitation")
        else None,
    }
    evidences.insert(0, new_evidence)
    write_evidences(evidences)
    return {"ok": True, "evidence": new_evidence, "count": len(evidences)}


# ---------------------------------------------------------------------------
# 4. Threads
# ---------------------------------------------------------------------------


@app.get("/api/threads")
async def api_threads() -> dict:
    threads = db.list_threads()
    if not threads:
        db.upsert_thread("session-principal", "Main Session", "tutor")
        threads = db.list_threads()
    return {
        "threads": [
            {
                "id": t["id"],
                "title": t["title"],
                "resourceId": t["resource_id"],
                "createdAt": t["created_at"],
                "updatedAt": t["updated_at"],
                "metadata": {"agentId": t["agent_id"]},
                "messageCount": t["messageCount"],
            }
            for t in threads
        ]
    }


@app.post("/api/thread/create")
async def thread_create(request: Request) -> dict:
    payload = await request.json()
    thread_id = payload.get("threadId") or db.new_id("thread")
    title = payload.get("title") or "New Session"
    db.upsert_thread(thread_id, title, payload.get("agentId", "tutor"))
    return {"ok": True, "threadId": thread_id, "title": title}


@app.post("/api/thread/delete")
async def thread_delete(request: Request) -> Any:
    (thread_id,) = _required(await request.json(), "threadId")
    db.delete_thread(thread_id)
    return {"ok": True}


@app.post("/api/thread/rename")
async def thread_rename(request: Request) -> Any:
    thread_id, title = _required(await request.json(), "threadId", "title")
    db.rename_thread(thread_id, title)
    return {"ok": True}


@app.post("/api/thread/clear")
async def thread_clear(request: Request) -> Any:
    (thread_id,) = _required(await request.json(), "threadId")
    db.clear_messages(thread_id)
    db.touch_thread(thread_id)
    return {"ok": True, "threadId": thread_id}


@app.post("/api/thread/truncate")
async def thread_truncate(request: Request) -> Any:
    thread_id, from_message_id = _required(await request.json(), "threadId", "fromMessageId")
    db.truncate_from(thread_id, from_message_id)
    db.touch_thread(thread_id)
    return {"ok": True}


async def _compact_thread(thread_id: str, keep_last: int = _AUTO_COMPACT_KEEP_LAST) -> dict:
    """Summarizes the old part of a long thread, keeping the last `keep_last` messages intact."""
    messages = db.list_messages(thread_id)

    if len(messages) <= keep_last + 1:
        return {"skipped": True}

    to_summarize = messages[: len(messages) - keep_last]
    to_keep = messages[len(messages) - keep_last :]

    lines = []
    for m in to_summarize:
        speaker = "User" if m["role"] == "user" else "Assistant"
        text = (m["content"] or "").strip()
        line = f"{speaker}: {text}"
        if line.endswith(": "):
            continue
        lines.append(line)
    transcript = "\n\n".join(lines)

    summary_text = "(unable to generate a summary)"
    try:
        agent = AGENTS["tutor"]
        result = await agent.run(
            "Summarize the conversation excerpt below into dense text (short "
            "paragraphs, no filler), preserving: decisions made, concrete facts "
            "about the project/code, and any open pending items. Do not invent "
            f"anything that isn't in the text.\n\n---\n{transcript}\n---",
            model=get_model(),
        )
        summary_text = result.output or summary_text
    except Exception:
        logger.exception("compactThread: error generating summary (thread=%s)", thread_id)

    cutoff_created_at = to_keep[0]["created_at"]
    db.delete_before(thread_id, cutoff_created_at)

    summary_timestamp = (
        datetime.fromisoformat(cutoff_created_at) - timedelta(seconds=1)
    ).isoformat()
    db.save_message(
        thread_id,
        "assistant",
        f"📦 [Automatic summary of {len(to_summarize)} earlier messages]\n\n{summary_text}",
        created_at=summary_timestamp,
    )
    db.touch_thread(thread_id)

    return {
        "skipped": False,
        "summarizedCount": len(to_summarize),
        "summaryText": summary_text,
    }


@app.post("/api/thread/compact")
async def thread_compact(request: Request) -> Any:
    payload = await request.json()
    (thread_id,) = _required(payload, "threadId")
    result = await _compact_thread(thread_id, payload.get("keepLast") or _AUTO_COMPACT_KEEP_LAST)
    return {"ok": True, **result}


@app.get("/api/thread/messages")
async def thread_messages(threadId: str = "session-principal") -> dict:
    thread = db.get_thread(threadId)
    messages = db.list_messages(threadId)
    tool_events = db.list_tool_events(threadId)
    return {
        "agentId": (thread or {}).get("agent_id") or "tutor",
        "messages": [
            {
                "id": m["id"],
                "role": m["role"],
                "text": m["content"],
                "createdAt": m["created_at"],
            }
            for m in messages
        ],
        "toolEvents": [
            {
                "id": e["id"],
                "messageId": e["message_id"],
                "toolCallId": e["tool_call_id"],
                "toolName": e["tool_name"],
                "skillId": e["skill_id"],
                "args": json.loads(e["args"]) if e["args"] else {},
                "result": json.loads(e["result"]) if e["result"] else None,
                "isError": bool(e["is_error"]),
                "createdAt": e["created_at"],
            }
            for e in tool_events
        ],
    }


@app.get("/api/thread/export")
async def thread_export(threadId: str = "session-principal") -> Any:
    thread = db.get_thread(threadId)
    messages = db.list_messages(threadId)
    title = (thread or {}).get("title") or "Tutor OS Session"
    agent_id = (thread or {}).get("agent_id") or "tutor"
    md = f"# {title}\n\n*Session ID: `{threadId}` | Agent: {agent_id}*\n\n---\n\n"
    if not messages:
        md += "*No messages recorded in this session.*\n"
    else:
        for m in messages:
            speaker = "### 👤 You" if m["role"] == "user" else "### ✦ Tutor OS"
            md += f"{speaker}\n\n{m['content']}\n\n---\n\n"
    return StreamingResponse(
        iter([md]),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="tutor-session-{threadId}.md"'},
    )


# ---------------------------------------------------------------------------
# 5. Workspace
# ---------------------------------------------------------------------------


@app.get("/api/workspace")
async def api_workspace() -> dict:
    return {
        **workspace_list(),
        "now": os_read("NOW.md")["content"],
        "inbox": os_read("INBOX.md")["content"],
    }


@app.get("/api/workspace/file")
async def api_workspace_file(
    path: str = "SPEC.md", slug: str | None = None, archived: bool = False
) -> dict:
    if slug:
        result = workspace_read(slug, path, archived)
        return {
            "slug": slug,
            "path": path,
            "content": result["content"],
            "isArchived": archived,
        }
    result = os_read(path)
    return {"path": path, "content": result["content"]}


@app.post("/api/workspace/write")
async def api_workspace_write(request: Request) -> dict:
    payload = await request.json()
    slug, path, content = (
        payload.get("slug"),
        payload.get("path"),
        payload.get("content"),
    )
    if slug:
        return workspace_write(slug, path, content)
    from tutor_os.tools.os_files import os_write

    return os_write(path, content)


@app.post("/api/workspace/init")
async def api_workspace_init(request: Request) -> dict:
    payload = await request.json()
    return workspace_init(
        project_slug=payload.get("slug"),
        title=payload.get("title") or payload.get("slug"),
        objective=payload.get("objective") or "Build physical understanding and system invariants",
        stack=payload.get("stack") or "Go / Rust",
    )


@app.post("/api/workspace/delete")
async def api_workspace_delete(request: Request) -> dict:
    payload = await request.json()
    return workspace_delete(
        payload.get("slug"), payload.get("path"), bool(payload.get("isArchived"))
    )


@app.post("/api/workspace/archive")
async def api_workspace_archive(request: Request) -> dict:
    payload = await request.json()
    return workspace_archive(payload.get("slug"), payload.get("action", "archive"))


@app.post("/api/workspace/phase")
async def api_workspace_phase(request: Request) -> dict:
    from tutor_os.tools.workspace import phase_set

    payload = await request.json()
    return phase_set(
        payload.get("slug"),
        payload.get("phase", 1),
        payload.get("status", "em-andamento"),
        payload.get("note"),
    )


# ---------------------------------------------------------------------------
# 6. Memory & meta
# ---------------------------------------------------------------------------


@app.get("/api/memory")
async def api_memory() -> dict:
    st = state_read()
    ep = episodes_recent(20)
    lib = library_index()
    obs = read_observations()
    return {
        "profile": st["profile"],
        "episodes": ep["episodes"],
        "library": lib["notes"],
        "totalNotes": lib["totalNotes"],
        "observations": obs,
    }


# 20.5.1 Memory Audit 3-Layer Graph API (DeepTutor-inspired L1 -> L2 -> L3)
@app.get("/api/memory/graph")
async def api_memory_graph() -> Any:
    return get_full_memory_graph()


@app.get("/api/memory/evidences")
async def api_memory_evidences(
    arcId: str | None = None, surface: str | None = None, search: str | None = None
) -> Any:
    return evidence_list(arc_id=arcId, surface=surface, search=search)


@app.post("/api/memory/evidence/create")
async def api_memory_evidence_create(request: Request) -> Any:
    payload = await request.json()
    evidences = read_evidences()
    ev_id = payload.get("id") or f"ev-{datetime.now(UTC).strftime('%Y%m%d')}-{short_id()}"
    confidence = payload.get("confidence")
    new_evidence: L2Evidence = {
        "id": ev_id,
        "claim": payload.get("claim") or "Proven evidence",
        "metric": payload.get("metric"),
        "sourceL1Id": payload.get("sourceL1Id") or f"ep-{datetime.now(UTC).strftime('%Y%m%d')}-01",
        "sourceRef": payload.get("sourceRef"),
        "surface": payload.get("surface") or "benchmark",
        "reproductionCommand": payload.get("reproductionCommand"),
        "arcId": payload.get("arcId"),
        "capabilityId": payload.get("capabilityId"),
        "verifiedBy": payload.get("verifiedBy") or "reviewer",
        "confidence": confidence if isinstance(confidence, int | float) else 1.0,
        "verifiedAt": datetime.now(UTC).isoformat(),
        "notes": payload.get("notes"),
    }

    existing_idx = next((i for i, e in enumerate(evidences) if e.get("id") == ev_id), -1)
    if existing_idx >= 0:
        evidences[existing_idx] = new_evidence
    else:
        evidences.append(new_evidence)
    write_evidences(evidences)

    if payload.get("capabilityId") and payload.get("arcId"):
        link_capability(payload["capabilityId"], new_evidence["claim"], ev_id)

    return {"ok": True, "evidence": new_evidence}


@app.post("/api/memory/evidence/delete")
async def api_memory_evidence_delete(request: Request) -> Any:
    payload = await request.json()
    ev_id = payload.get("id")
    if not ev_id:
        raise ValueError("evidence id is required")
    evidences = read_evidences()
    evidences = [e for e in evidences if e.get("id") != ev_id]
    write_evidences(evidences)
    return {"ok": True, "evidences": evidences}


@app.post("/api/memory/observation/add")
async def api_memory_observation_add(request: Request) -> Any:
    payload = await request.json()
    return observation_capture(payload.get("tag") or "Insight", payload.get("text") or "")


@app.post("/api/memory/observation/update")
async def api_memory_observation_update(request: Request) -> Any:
    payload = await request.json()
    index = payload.get("index")
    if index is None:
        raise ValueError("index is required")
    return observation_update(
        int(index), payload.get("tag") or "Insight", payload.get("text") or ""
    )


@app.post("/api/memory/observation/delete")
async def api_memory_observation_delete(request: Request) -> Any:
    payload = await request.json()
    index = payload.get("index")
    if index is None:
        raise ValueError("index is required")
    return observation_delete(int(index))


@app.post("/api/memory/episode/delete")
async def api_memory_episode_delete(request: Request) -> Any:
    payload = await request.json()
    return episodes_delete(
        index=payload.get("index"),
        date=payload.get("date"),
        project_slug=payload.get("projectSlug"),
        topic=payload.get("topic"),
    )


@app.post("/api/memory/episodes/clear")
async def api_memory_episodes_clear() -> Any:
    return episodes_clear()


@app.post("/api/memory/purge")
async def api_memory_purge() -> Any:
    """Hard reset: clears episodic history, resets observations to the default
    calibration, and wipes all chat threads/messages/tool events."""
    episodes_clear()
    observations_reset()
    db.delete_all_threads()
    return {"ok": True}


@app.get("/api/meta/overview")
async def api_meta_overview() -> dict:
    return meta_overview()


@app.post("/api/meta/now")
async def api_meta_now(request: Request) -> dict:
    payload = await request.json()
    return meta_set_now(
        project_slug=payload.get("projectSlug"),
        mission=payload.get("mission"),
        objective=payload.get("objective"),
        next_action=payload.get("nextAction"),
        phase=payload.get("phase", 1),
    )


# ---------------------------------------------------------------------------
# 8. Utility panels: rescue/library/inbox/experiments
# ---------------------------------------------------------------------------

EXPERIMENTS_PATH = WORKSPACE_ROOT / "_meta" / "EXPERIMENTS.json"


@app.post("/api/rescue")
async def api_rescue(request: Request) -> Any:
    payload = await request.json()
    return rescue_diagnose(
        payload.get("scenario") or "stuck_midway",
        details=payload.get("notes") or "",
    )


@app.get("/api/library")
async def api_library() -> Any:
    return library_index()


@app.post("/api/inbox")
async def api_inbox(request: Request) -> Any:
    payload = await request.json()
    inbox_path = WORKSPACE_ROOT / "INBOX.md"
    content = (
        inbox_path.read_text(encoding="utf-8")
        if inbox_path.exists()
        else "# INBOX\n\nIdea holding area — not a task queue.\n\n"
    )
    timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M")
    idea_entry = (
        f"\n### [{timestamp}] {payload.get('idea') or 'New Idea'}\n"
        f"- **Why it seems interesting:** {payload.get('reason') or 'Not specified'}\n"
        f"- **Possible next step:** {payload.get('nextStep') or 'Not specified'}\n"
    )
    content += idea_entry
    inbox_path.parent.mkdir(parents=True, exist_ok=True)
    inbox_path.write_text(content, encoding="utf-8")
    return {"ok": True, "message": "Idea safely captured in INBOX!"}


@app.get("/api/experiments")
async def api_experiments_get() -> Any:
    if not EXPERIMENTS_PATH.exists():
        initial_exp = [
            {
                "id": "exp-01",
                "title": "Tracer Bullet in <15 min before reading documentation",
                "hypothesis": (
                    "Writing the smallest failing code before reading theory "
                    "reduces choice paralysis."
                ),
                "tweak": (
                    "Open the editor and run the first test in <10 lines "
                    "before opening docs/articles."
                ),
                "metric": "Time to first green test",
                "status": "active",
                "createdAt": datetime.now(UTC).strftime("%Y-%m-%d"),
            }
        ]
        EXPERIMENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
        EXPERIMENTS_PATH.write_text(
            json.dumps(initial_exp, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    data = json.loads(EXPERIMENTS_PATH.read_text(encoding="utf-8"))
    return {"experiments": data}


@app.post("/api/experiments")
async def api_experiments_post(request: Request) -> Any:
    payload = await request.json()
    exps = (
        json.loads(EXPERIMENTS_PATH.read_text(encoding="utf-8"))
        if EXPERIMENTS_PATH.exists()
        else []
    )
    action = payload.get("action")
    if action == "add":
        exps.insert(
            0,
            {
                "id": f"exp-{short_id()}",
                "title": payload.get("title"),
                "hypothesis": payload.get("hypothesis"),
                "tweak": payload.get("tweak"),
                "metric": payload.get("metric"),
                "status": "active",
                "createdAt": datetime.now(UTC).strftime("%Y-%m-%d"),
            },
        )
    elif action == "updateStatus":
        target = next((e for e in exps if e.get("id") == payload.get("id")), None)
        if target:
            target["status"] = payload.get("status")
    elif action == "delete":
        exps = [e for e in exps if e.get("id") != payload.get("id")]
    EXPERIMENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    EXPERIMENTS_PATH.write_text(json.dumps(exps, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"ok": True, "experiments": exps}


# ---------------------------------------------------------------------------
# 9. Arcs (capability arc mutation panel)
# ---------------------------------------------------------------------------


@app.get("/api/arcs")
async def api_arcs_get() -> Any:
    arcs = read_arcs_data()
    return {"arcs": arcs}


@app.post("/api/arcs")
async def api_arcs_post(request: Request) -> Any:
    payload = await request.json()
    arcs = payload.get("arcs") or []
    save_arcs_data(arcs)
    return {"ok": True, "arcs": arcs}


@app.post("/api/arc/update")
async def api_arc_update(request: Request) -> Any:
    payload = await request.json()
    arc = payload.get("arc")
    if not arc or not arc.get("id"):
        raise ValueError("arc object with id is required")
    arcs = read_arcs_data()
    idx = next((i for i, a in enumerate(arcs) if a.get("id") == arc["id"]), -1)
    now = datetime.now(UTC).isoformat()
    if idx >= 0:
        arcs[idx] = {**arcs[idx], **arc, "updatedAt": now}
    else:
        arcs.append({**arc, "updatedAt": now})
    save_arcs_data(arcs)
    return {"ok": True, "arcs": arcs}


@app.post("/api/arc/verify")
async def api_arc_verify(request: Request) -> Any:
    payload = await request.json()
    arc_id = payload.get("arcId")
    capability_id = payload.get("capabilityId")
    evidence = payload.get("evidence")
    if not arc_id or not capability_id:
        raise ValueError("arcId and capabilityId are required")
    arcs = read_arcs_data()
    arc = next((a for a in arcs if a.get("id") == arc_id), None)
    if not arc:
        raise ValueError(f"Arc not found: {arc_id}")
    cap = next((c for c in arc["capabilities"] if c.get("id") == capability_id), None)
    now = datetime.now(UTC).isoformat()
    if cap:
        cap["verified"] = True
        cap["evidence"] = evidence or "Demonstrated and successfully verified."
        cap["verifiedAt"] = now
    else:
        arc["capabilities"].append({
            "id": capability_id,
            "title": capability_id,
            "verified": True,
            "evidence": evidence or "Demonstrated and verified successfully.",
            "verifiedAt": now,
        })
    save_arcs_data(arcs)
    return {"ok": True, "arcs": arcs}


@app.post("/api/arc/delete")
async def api_arc_delete(request: Request) -> Any:
    payload = await request.json()
    arc_id = payload.get("arcId")
    if not arc_id:
        raise ValueError("arcId is required")
    arcs = [a for a in read_arcs_data() if a.get("id") != arc_id]
    save_arcs_data(arcs)
    return {"ok": True, "arcs": arcs}


# ---------------------------------------------------------------------------
# 10. Session workflow (Inverted Pyramid phase gates)
# ---------------------------------------------------------------------------


@app.post("/api/session/start")
async def api_session_start(request: Request) -> Any:
    payload = await request.json()
    return session_start(
        payload.get("projectSlug"),
        payload.get("title"),
        payload.get("objective"),
        payload.get("stack"),
    )


@app.post("/api/session/advance")
async def api_session_advance(request: Request) -> Any:
    payload = await request.json()
    return session_advance(
        payload.get("projectSlug"),
        payload.get("phase"),
        bool(payload.get("passed")),
        payload.get("note"),
    )


# ---------------------------------------------------------------------------
# 7. Static UI (SPA fallback, mirrors server.ts's file server)
# ---------------------------------------------------------------------------


@app.get("/{full_path:path}")
async def static_ui(full_path: str) -> FileResponse:
    candidate = UI_DIR / full_path if full_path else UI_DIR / "index.html"
    if not candidate.exists() or candidate.is_dir():
        candidate = UI_DIR / "index.html"
    media_type = mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
    return FileResponse(candidate, media_type=media_type)


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "4115"))
    uvicorn.run(app, host="0.0.0.0", port=port)
