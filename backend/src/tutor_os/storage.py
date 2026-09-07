"""Filesystem roots, JSON/text helpers, and the SQLite connection.

PROJECT_ROOT is the repo root regardless of cwd; override it with TUTOR_OS_ROOT.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

logger = logging.getLogger("tutor_os")

PROJECT_ROOT = Path(os.environ.get("TUTOR_OS_ROOT") or Path(__file__).resolve().parents[3])
WORKSPACE_ROOT = PROJECT_ROOT / "workspace"
META_DIR = WORKSPACE_ROOT / "_meta"
DB_PATH = PROJECT_ROOT / "tutor-os-py.db"


def safe_path(base: Path, rel_path: str = "") -> Path:
    """Resolves `rel_path` under `base`, refusing anything that escapes it."""
    root = base.resolve()
    full = (root / rel_path).resolve()
    if full != root and root not in full.parents:
        raise ValueError(f"Path outside the bounds of {root.name}: {rel_path}")
    return full


def write_text(path: Path, content: str) -> None:
    """Writes UTF-8, creating parent directories as needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def read_text(path: Path, default: str = "") -> str:
    return path.read_text(encoding="utf-8") if path.exists() else default


def read_json(path: Path, default: Any = None) -> Any:
    """Returns `default` if the file is missing or unparseable."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default
    except (OSError, json.JSONDecodeError) as err:
        logger.warning("Could not read %s: %s", path.name, err)
        return default


def write_json(path: Path, data: Any) -> None:
    write_text(path, json.dumps(data, indent=2, ensure_ascii=False))


def read_jsonl(path: Path) -> list[Any]:
    return [json.loads(line) for line in read_text(path).splitlines() if line.strip()]


def write_jsonl(path: Path, rows: list[Any]) -> None:
    write_text(path, "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))


def append_jsonl(path: Path, row: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


_SCHEMA = """
CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    agent_id TEXT NOT NULL DEFAULT 'tutor',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages (thread_id, created_at);

CREATE TABLE IF NOT EXISTS tool_events (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    turn_id TEXT NOT NULL,
    message_id TEXT,
    tool_call_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    skill_id TEXT,
    args TEXT NOT NULL,
    result TEXT,
    is_error INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_events_thread ON tool_events (thread_id, created_at);
"""


def init_db() -> None:
    PROJECT_ROOT.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        conn.executescript(_SCHEMA)


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
