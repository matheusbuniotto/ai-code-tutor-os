"""Full workspace backup / reset / restore — lets a learner start a clean
onboarding without losing their prior progress, and lets a workspace be
carried between machines.
"""

from __future__ import annotations

import io
import shutil
import zipfile
from datetime import UTC, datetime
from pathlib import Path

from tutor_os.config.learner_profile import reload_learner_profile, reset_learner_profile
from tutor_os.db import delete_all_threads
from tutor_os.storage import WORKSPACE_ROOT, seed_meta_dir
from tutor_os.tools.observations import observations_reset

BACKUPS_DIR = WORKSPACE_ROOT / "_backups"
# _meta_example is the committed onboarding template (not user data) — never touch it.
_SKIP_TOP_LEVEL = {"_backups", "_meta_example"}


def _iter_workspace_files():
    if not WORKSPACE_ROOT.exists():
        return
    for path in WORKSPACE_ROOT.rglob("*"):
        if path.is_dir():
            continue
        if path.relative_to(WORKSPACE_ROOT).parts[0] in _SKIP_TOP_LEVEL:
            continue
        yield path


def export_workspace_zip() -> bytes:
    """Zips the entire workspace/ (profile, arcs, episodes, projects, archive) for backup/transfer."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in _iter_workspace_files():
            zf.write(path, arcname=str(path.relative_to(WORKSPACE_ROOT)))
    return buf.getvalue()


def _save_backup(label: str) -> Path:
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    path = BACKUPS_DIR / f"{label}-{stamp}.zip"
    path.write_bytes(export_workspace_zip())
    return path


def export_workspace() -> tuple[bytes, Path]:
    """Zips the entire workspace, archives a copy in _backups/, and returns (data, backup_path)."""
    data = export_workspace_zip()
    backup_path = _save_backup("export")
    return data, backup_path


def _wipe_workspace() -> None:
    if not WORKSPACE_ROOT.exists():
        return
    for entry in WORKSPACE_ROOT.iterdir():
        if entry.name in _SKIP_TOP_LEVEL:
            continue
        if entry.is_dir():
            shutil.rmtree(entry)
        else:
            entry.unlink()


def reset_workspace() -> dict:
    """Archives the current workspace to workspace/_backups/, wipes all user state,
    clears chat threads/messages to prevent data leakage, and seeds a fresh blank onboarding state.
    """
    backup_path = _save_backup("reset")
    _wipe_workspace()
    seed_meta_dir()
    observations_reset()
    delete_all_threads()
    reset_learner_profile()
    return {"ok": True, "backupPath": str(backup_path.relative_to(WORKSPACE_ROOT.parent))}


def import_workspace_zip(data: bytes) -> dict:
    """Restores a workspace previously produced by export_workspace_zip, replacing the current one.

    The current workspace is backed up first (workspace/_backups/pre-import-*.zip),
    so an import can always be undone by importing that file back. Old threads are cleared
    so previous conversation state does not leak into the imported workspace.
    """
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        root = WORKSPACE_ROOT.resolve()
        for name in zf.namelist():
            member = (WORKSPACE_ROOT / name).resolve()
            if member != root and root not in member.parents:
                raise ValueError(f"Refusing unsafe path in archive: {name}")
        backup_path = _save_backup("pre-import")
        _wipe_workspace()
        zf.extractall(WORKSPACE_ROOT)
        seed_meta_dir()
        delete_all_threads()
        reload_learner_profile()
    return {"ok": True, "backupPath": str(backup_path.relative_to(WORKSPACE_ROOT.parent))}
