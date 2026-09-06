"""Port of src/mastra/config/workspace-root.ts.

Not yet wired into tutor_os.storage — ported standalone for parity since the
TS source itself is a new, uncommitted module not yet integrated into
storage.ts. Wire it in once the Node side does.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

_REPO_ROOT = Path(os.environ.get("TUTOR_OS_ROOT") or Path(__file__).resolve().parents[3])

# Lives at the repo root, outside workspace/ — if the workspace is relocated, the
# pointer to it can't live inside the workspace itself.
_OVERRIDE_PATH = _REPO_ROOT / "workspace-root.local.json"
_DEFAULT_WORKSPACE_ROOT = _REPO_ROOT / "workspace"


def _read_override() -> str | None:
    if not _OVERRIDE_PATH.exists():
        return None
    try:
        raw = json.loads(_OVERRIDE_PATH.read_text(encoding="utf-8"))
        path = raw.get("path")
        return path.strip() if isinstance(path, str) and path.strip() else None
    except Exception:
        return None


def resolve_workspace_root() -> Path:
    """Resolution order: saved override via UI/API > env var > default inside the repo."""
    override = _read_override()
    if override:
        return Path(override)
    env_root = os.environ.get("TUTOR_OS_WORKSPACE_ROOT")
    if env_root:
        return Path(env_root)
    return _DEFAULT_WORKSPACE_ROOT


@dataclass
class WorkspaceRootInfo:
    path: str
    source: str  # "override" | "env" | "default"
    default_path: str


def get_workspace_root_info() -> WorkspaceRootInfo:
    override = _read_override()
    if override:
        source = "override"
    elif os.environ.get("TUTOR_OS_WORKSPACE_ROOT"):
        source = "env"
    else:
        source = "default"
    return WorkspaceRootInfo(
        path=str(resolve_workspace_root()),
        source=source,
        default_path=str(_DEFAULT_WORKSPACE_ROOT),
    )


def set_workspace_root_override(new_path: str) -> WorkspaceRootInfo:
    """Only takes effect after a server restart — WORKSPACE_ROOT is frozen at boot in storage.py."""
    abs_path = str(Path(new_path.strip()).resolve())
    _OVERRIDE_PATH.write_text(json.dumps({"path": abs_path}, indent=2), encoding="utf-8")
    return get_workspace_root_info()


def clear_workspace_root_override() -> WorkspaceRootInfo:
    if _OVERRIDE_PATH.exists():
        _OVERRIDE_PATH.write_text(json.dumps({"path": ""}, indent=2), encoding="utf-8")
    return get_workspace_root_info()


def ensure_workspace_root_bootstrap(root: Path) -> None:
    """A freshly relocated root outside the repo won't come with _meta/ ready."""
    (root / "_meta").mkdir(parents=True, exist_ok=True)
    (root / "_archive").mkdir(parents=True, exist_ok=True)
