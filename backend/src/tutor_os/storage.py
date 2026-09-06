"""Filesystem roots and the SQLite connection.

Port of src/mastra/storage.ts. PROJECT_ROOT is always the tutor-os repo root
regardless of cwd. Mirrors the TS behavior as it stands today (WORKSPACE_ROOT
is hardcoded to PROJECT_ROOT/workspace) — the not-yet-wired override system in
src/mastra/config/workspace-root.ts is ported separately in
tutor_os.config.workspace_root but is NOT used here, matching the current
Node backend.

Uses its own SQLite file (tutor-os-py.db) rather than the Node backend's
tutor-os.db: the two backends have different message-table schemas, and
sharing a file would risk corrupting either side's data.
"""

from __future__ import annotations

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

PROJECT_ROOT = Path(os.environ.get("TUTOR_OS_ROOT") or Path(__file__).resolve().parents[3])
WORKSPACE_ROOT = PROJECT_ROOT / "workspace"

DB_PATH = PROJECT_ROOT / "tutor-os-py.db"

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
