"""OS-level workspace files outside any project: NOW.md, INBOX.md, sessions/, reviews/.

Templates in _templates/ are readable but not writable.
"""

from __future__ import annotations

from pathlib import Path

from tutor_os.storage import WORKSPACE_ROOT, read_text, safe_path, write_text

_FORBIDDEN_WRITE = {"_templates", "_meta"}


def _safe_os_path(rel_path: str, for_write: bool = False) -> Path:
    full = safe_path(WORKSPACE_ROOT, rel_path)
    if for_write:
        root = WORKSPACE_ROOT.resolve()
        top = full.relative_to(root).parts[0] if full != root else ""
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
    write_text(full, content)
    return {"ok": True, "fullPath": str(full)}


def os_read(path: str) -> dict:
    """Reads a file at the workspace's OS level.

    NOW.md, INBOX.md, templates in _templates/, sessions and reviews.

    Args:
        path: relative to the workspace root, e.g. INBOX.md or _templates/learning-review.md.
    """
    full = _safe_os_path(path, for_write=False)
    return {"content": read_text(full, f"(file does not exist: {path})")}
