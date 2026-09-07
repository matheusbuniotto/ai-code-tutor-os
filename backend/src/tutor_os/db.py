"""Thread, message and tool-event persistence over SQLite.

Plain functions rather than a store object: nothing here needs a framework.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Literal

from tutor_os.storage import get_connection

Role = Literal["user", "assistant"]

RESOURCE_ID = "learner"

LAST_MESSAGES = 30


def _now() -> str:
    return datetime.now(UTC).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def get_thread(thread_id: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM threads WHERE id = ?", (thread_id,)).fetchone()
        return dict(row) if row else None


def upsert_thread(thread_id: str, title: str, agent_id: str = "tutor") -> None:
    now = _now()
    with get_connection() as conn:
        existing = conn.execute("SELECT id FROM threads WHERE id = ?", (thread_id,)).fetchone()
        if existing:
            conn.execute(
                "UPDATE threads SET title = ?, agent_id = ?, updated_at = ? WHERE id = ?",
                (title, agent_id, now, thread_id),
            )
        else:
            conn.execute(
                "INSERT INTO threads (id, title, resource_id, agent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (thread_id, title, RESOURCE_ID, agent_id, now, now),
            )


def touch_thread(thread_id: str) -> None:
    with get_connection() as conn:
        conn.execute("UPDATE threads SET updated_at = ? WHERE id = ?", (_now(), thread_id))


def rename_thread(thread_id: str, title: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE threads SET title = ?, updated_at = ? WHERE id = ?",
            (title, _now(), thread_id),
        )


def delete_thread(thread_id: str) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM messages WHERE thread_id = ?", (thread_id,))
        conn.execute("DELETE FROM threads WHERE id = ?", (thread_id,))


def list_threads() -> list[dict]:
    with get_connection() as conn:
        threads = [
            dict(r)
            for r in conn.execute("SELECT * FROM threads WHERE resource_id = ?", (RESOURCE_ID,))
        ]
        counts = {
            r["thread_id"]: r["count"]
            for r in conn.execute(
                "SELECT thread_id, count(*) as count FROM messages GROUP BY thread_id"
            )
        }
    for t in threads:
        t["messageCount"] = counts.get(t["id"], 0)
    threads.sort(key=lambda t: t["updated_at"], reverse=True)
    return threads


def list_messages(thread_id: str) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC",
            (thread_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def save_message(
    thread_id: str,
    role: Role,
    content: str,
    message_id: str | None = None,
    created_at: str | None = None,
) -> str:
    message_id = message_id or new_id(f"msg-{role[0]}")
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO messages (id, thread_id, resource_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (message_id, thread_id, RESOURCE_ID, role, content, created_at or _now()),
        )
    return message_id


def clear_messages(thread_id: str) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM messages WHERE thread_id = ?", (thread_id,))


def truncate_from(thread_id: str, from_message_id: str) -> None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT created_at FROM messages WHERE id = ? AND thread_id = ?",
            (from_message_id, thread_id),
        ).fetchone()
        if not row:
            raise ValueError("Message not found")
        conn.execute(
            "DELETE FROM messages WHERE thread_id = ? AND created_at >= ?",
            (thread_id, row["created_at"]),
        )


def save_tool_call(
    thread_id: str,
    turn_id: str,
    tool_call_id: str,
    tool_name: str,
    skill_id: str | None,
    args_json: str,
) -> str:
    event_id = new_id("tool")
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO tool_events (id, thread_id, turn_id, message_id, tool_call_id, "
            "tool_name, skill_id, args, result, is_error, created_at) "
            "VALUES (?, ?, ?, NULL, ?, ?, ?, ?, NULL, 0, ?)",
            (event_id, thread_id, turn_id, tool_call_id, tool_name, skill_id, args_json, _now()),
        )
    return event_id


def save_tool_result(tool_call_id: str, result_json: str, is_error: bool) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE tool_events SET result = ?, is_error = ? "
            "WHERE tool_call_id = ? AND result IS NULL",
            (result_json, int(is_error), tool_call_id),
        )


def set_tool_events_message_id(turn_id: str, message_id: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE tool_events SET message_id = ? WHERE turn_id = ?", (message_id, turn_id)
        )


def list_tool_events(thread_id: str) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM tool_events WHERE thread_id = ? ORDER BY created_at ASC",
            (thread_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def delete_all_threads() -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM messages")
        conn.execute("DELETE FROM threads")
        conn.execute("DELETE FROM tool_events")


def delete_before(thread_id: str, cutoff_created_at: str) -> None:
    """Delete all messages in `thread_id` older than `cutoff_created_at`.

    Mirrors `truncate_from`'s shape but for compaction: it deletes everything
    BEFORE a cutoff timestamp (rather than everything from/after a given
    message id), since compaction already knows the cutoff created_at from
    `list_messages` and has no need for TS's raw-SQL lookup-by-id dance.
    """
    with get_connection() as conn:
        conn.execute(
            "DELETE FROM messages WHERE thread_id = ? AND created_at < ?",
            (thread_id, cutoff_created_at),
        )
