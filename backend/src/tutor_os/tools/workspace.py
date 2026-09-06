"""Port of src/mastra/tools/workspace.ts."""

from __future__ import annotations

import re
import shutil
from datetime import date
from pathlib import Path

from tutor_os.storage import WORKSPACE_ROOT
from tutor_os.tools.meta import clear_now_if_active_project

_PROJECT_TEMPLATE_DIRS = ["01-topology", "02-tracer-bullet", "03-break-edges", "cards"]
_SLUG_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def _check_slug(slug: str) -> None:
    if not slug or not _SLUG_RE.match(slug):
        raise ValueError("slug: letters, digits, hyphen, and underscore only")


def _project_dir(slug: str) -> Path:
    return WORKSPACE_ROOT / slug


def _safe_path(slug: str, rel_path: str) -> Path:
    """Guards against path traversal: the resolved path must stay strictly inside the project."""
    base = _project_dir(slug).resolve()
    full = (base / rel_path).resolve()
    if full != base and base not in full.parents:
        raise ValueError(f'Path outside the bounds of project "{slug}": {rel_path}')
    return full


def _safe_workspace_path(rel_path: str) -> Path:
    base = WORKSPACE_ROOT.resolve()
    full = (base / rel_path).resolve()
    if full != base and base not in full.parents:
        raise ValueError(f"Path outside the workspace bounds: {rel_path}")
    return full


def _spec_template(title: str, objective: str, stack: str) -> str:
    return f"""# SPEC — {title}

**Stack:** {stack}
**Objective:** {objective}
**Current phase:** 1/4 (macro-topology)

---

## [WHY]
<!-- 2-3 lines: where this fits in the architecture + who calls it + failure case -->

## [NEW CONCEPT]
<!-- ONE concept. Mundane analogy before the code + minimal isolated artifact -->

## [BEFORE/AFTER]
<!-- naive version → modern version + 1 line on what changed and why -->

## [YOU WRITE]
<!-- what you implement (scaffolding calibrated to the level) -->

## [I DO]
<!-- what the tutor executes (boilerplate, setup, integration with no new concept) -->

## [CRITERION]
"Done when: ..."

## [HUMAN GATE]
<!-- exact command you run to validate -->
"""


def _state_template() -> str:
    return f"""# STATE

fase: 1
status: em-andamento
ultima_sessao: {date.today().isoformat()}

## Phase Log
- fase:1 started
"""


def _list_files_recursive(dir_path: Path, base_dir: Path | None = None) -> list[str]:
    base_dir = base_dir or dir_path
    if not dir_path.exists():
        return []
    files: list[str] = []
    for entry in sorted(dir_path.iterdir()):
        rel = str(entry.relative_to(base_dir))
        if entry.is_dir():
            files.append(rel)
            files.extend(_list_files_recursive(entry, base_dir))
        else:
            files.append(rel)
    return files


def workspace_init(project_slug: str, title: str, objective: str, stack: str) -> dict:
    """Creates the folder structure for a new learning project inside workspace/.

    Call BEFORE writing any artifact. Returns the created paths.

    Args:
        project_slug: e.g. sysdesign-mod01-latency.
        title: Project title (min. 3 chars).
        objective: Project objective (min. 10 chars).
        stack: Technology stack.
    """
    _check_slug(project_slug)
    dir_path = _project_dir(project_slug)
    dir_path.mkdir(parents=True, exist_ok=True)

    created: list[str] = []
    for sub in _PROJECT_TEMPLATE_DIRS:
        p = dir_path / sub
        if not p.exists():
            p.mkdir()
        created.append(sub)

    spec_path = dir_path / "SPEC.md"
    if not spec_path.exists():
        spec_path.write_text(_spec_template(title, objective, stack), encoding="utf-8")
        created.append("SPEC.md")

    state_path = dir_path / "STATE.md"
    if not state_path.exists():
        state_path.write_text(_state_template(), encoding="utf-8")
        created.append("STATE.md")

    return {
        "created": created,
        "specPath": str(spec_path),
        "statePath": str(state_path),
    }


def workspace_write(project_slug: str, path: str, content: str) -> dict:
    """Writes an artifact inside the active project's folder.

    Path is relative to the project; it cannot leave the folder.

    Args:
        project_slug: project slug.
        path: relative to the project folder, e.g. 01-topology/mapa.md.
        content: file content.
    """
    full = _safe_path(project_slug, path)
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(content, encoding="utf-8")
    return {"ok": True, "fullPath": str(full)}


def workspace_read(project_slug: str, path: str, is_archived: bool = False) -> dict:
    """Reads an artifact from the active or archived project."""
    full = (
        (WORKSPACE_ROOT / "_archive" / project_slug / path)
        if is_archived
        else _safe_path(project_slug, path)
    )
    content = (
        full.read_text(encoding="utf-8") if full.exists() else f"(file does not exist: {path})"
    )
    return {"content": content}


def workspace_delete(
    project_slug: str | None = None, path: str | None = None, is_archived: bool = False
) -> dict:
    """Safely deletes an artifact file or an entire project inside workspace/ or workspace/_archive/."""
    if is_archived:
        base = WORKSPACE_ROOT / "_archive" / (project_slug or "")
        target = (base / path) if path else base
    elif project_slug:
        target = _safe_path(project_slug, path) if path else _safe_workspace_path(project_slug)
    elif path:
        target = _safe_workspace_path(path)
    else:
        raise ValueError("Specify a project or a file to delete")

    if target.exists():
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()

    if not is_archived and project_slug and not path:
        clear_now_if_active_project(project_slug)

    return {"ok": True, "deletedPath": str(target)}


def workspace_archive(project_slug: str, action: str = "archive") -> dict:
    """Archives/completes or restores a project by moving it between workspace/ and workspace/_archive/.

    Args:
        project_slug: project slug (min. 1 char).
        action: archive | restore.
    """
    archive_root = WORKSPACE_ROOT / "_archive"
    archive_root.mkdir(parents=True, exist_ok=True)

    src_dir = (
        _safe_workspace_path(project_slug) if action == "archive" else archive_root / project_slug
    )
    dest_dir = (
        (archive_root / project_slug) if action == "archive" else _safe_workspace_path(project_slug)
    )

    if not src_dir.exists():
        raise ValueError(f"Source directory not found: {src_dir}")

    if dest_dir.exists():
        shutil.rmtree(dest_dir)

    if action == "archive":
        state_path = src_dir / "STATE.md"
        if state_path.exists():
            try:
                content = state_path.read_text(encoding="utf-8")
                content = re.sub(r"^status: .*$", "status: concluido", content, flags=re.MULTILINE)
                content += f"\n- archived on {date.today().isoformat()}\n"
                state_path.write_text(content, encoding="utf-8")
            except Exception:
                pass

    shutil.move(str(src_dir), str(dest_dir))

    if action == "archive":
        clear_now_if_active_project(project_slug)

    verb = "archived as completed" if action == "archive" else "restored"
    return {"ok": True, "message": f"Project {project_slug} {verb} successfully."}


def workspace_list() -> dict:
    """Lists active and archived projects in workspace/ and all their files recursively."""
    if not WORKSPACE_ROOT.exists():
        return {"projects": [], "archivedProjects": []}

    projects: list[dict] = []
    archived_projects: list[dict] = []

    for entry in sorted(WORKSPACE_ROOT.iterdir()):
        if not entry.is_dir() or entry.name.startswith("."):
            continue
        if entry.name == "_archive":
            for archived_entry in sorted(entry.iterdir()):
                if not archived_entry.is_dir() or archived_entry.name.startswith("."):
                    continue
                archived_projects.append({
                    "slug": archived_entry.name,
                    "files": _list_files_recursive(archived_entry),
                })
            continue
        if entry.name.startswith("_"):
            continue
        projects.append({"slug": entry.name, "files": _list_files_recursive(entry)})

    return {"projects": projects, "archivedProjects": archived_projects}


def phase_set(project_slug: str, phase: int, status: str, note: str | None = None) -> dict:
    """Updates the phase (1-4) and status in the project's STATE.md.

    Phases: 1=macro-topology, 2=tracer-bullet, 3=break-edges, 4=architecture-note.

    Args:
        project_slug: project slug.
        phase: 1 to 4.
        status: em-andamento | concluido | pausado (kept as the existing
            STATE.md status values — see py/NEXT-PHASES.md's i18n scope note).
        note: optional log note.
    """
    state_path = _safe_path(project_slug, "STATE.md")
    body = state_path.read_text(encoding="utf-8") if state_path.exists() else _state_template()
    body = re.sub(r"^fase: .*$", f"fase: {phase}", body, flags=re.MULTILINE)
    body = re.sub(r"^status: .*$", f"status: {status}", body, flags=re.MULTILINE)
    body = re.sub(
        r"^ultima_sessao: .*$",
        f"ultima_sessao: {date.today().isoformat()}",
        body,
        flags=re.MULTILINE,
    )
    if note:
        body += f"- fase:{phase} — {note}\n"
    state_path.write_text(body, encoding="utf-8")
    return {"ok": True}
