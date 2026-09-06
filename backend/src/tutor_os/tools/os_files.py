"""Port of src/mastra/tools/os-files.ts.

OS-level workspace files (outside projects): NOW.md, INBOX.md, sessions/,
reviews/. Templates in _templates/ are read-only here.
"""

from __future__ import annotations

from pathlib import Path

from tutor_os.storage import WORKSPACE_ROOT

_FORBIDDEN_WRITE = {"_templates", "_meta"}


def _safe_os_path(rel_path: str, for_write: bool = False) -> Path:
    base = WORKSPACE_ROOT.resolve()
    full = (base / rel_path).resolve()
    if full != base and base not in full.parents:
        raise ValueError(f"Path outside the workspace: {rel_path}")
    if for_write:
        top = full.relative_to(base).parts[0] if full != base else ""
        if top in _FORBIDDEN_WRITE:
            raise ValueError(f"Directory protected from writes: {top}")
    return full


def os_write(path: str, content: str) -> dict:
    """Writes a file at the workspace's OS level (outside projects).

    NOW.md, INBOX.md, sessions/<date>-<topic>.md, reviews/<file>. Does not
    allow writing to _templates/ or _meta/.

    Args:
        path: relative to the workspace root, e.g. NOW.md.
        content: file content.
    """
    full = _safe_os_path(path, for_write=True)
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(content, encoding="utf-8")
    return {"ok": True, "fullPath": str(full)}


def os_read(path: str) -> dict:
    """Reads a file at the workspace's OS level.

    NOW.md, INBOX.md, templates in _templates/, sessions and reviews.

    Args:
        path: relative to the workspace root, e.g. INBOX.md or _templates/learning-review.md.
    """
    full = _safe_os_path(path, for_write=False)
    content = (
        full.read_text(encoding="utf-8") if full.exists() else f"(file does not exist: {path})"
    )
    return {"content": content}
