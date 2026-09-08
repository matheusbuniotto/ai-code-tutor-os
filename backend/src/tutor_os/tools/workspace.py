"""Project workspaces: per-project folders, artifacts, and phase state."""

from __future__ import annotations

import re
import shutil
from datetime import date
from pathlib import Path

from tutor_os.storage import WORKSPACE_ROOT, read_text, safe_path, write_text
from tutor_os.tools.meta import clear_now_if_active_project

ARCHIVE_ROOT = WORKSPACE_ROOT / "_archive"
_PROJECT_TEMPLATE_DIRS = ["01-topology", "02-tracer-bullet", "03-break-edges", "cards"]
_SLUG_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def _check_slug(slug: str) -> None:
    if not slug or not _SLUG_RE.match(slug):
        raise ValueError("slug: letters, digits, hyphen, and underscore only")


def _project_path(slug: str, rel_path: str = "") -> Path:
    """Both hops are checked: the slug must stay in the workspace, the path in the project."""
    return safe_path(safe_path(WORKSPACE_ROOT, slug), rel_path)


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
    dir_path = WORKSPACE_ROOT / project_slug
    created = list(_PROJECT_TEMPLATE_DIRS)
    for sub in _PROJECT_TEMPLATE_DIRS:
        (dir_path / sub).mkdir(parents=True, exist_ok=True)

    spec_path = dir_path / "SPEC.md"
    state_path = dir_path / "STATE.md"
    for path, template in (
        (spec_path, _spec_template(title, objective, stack)),
        (state_path, _state_template()),
    ):
        if not path.exists():
            write_text(path, template)
            created.append(path.name)

    return {"created": created, "specPath": str(spec_path), "statePath": str(state_path)}


def workspace_write(project_slug: str, path: str, content: str) -> dict:
    """Writes an artifact inside the active project's folder.

    Path is relative to the project; it cannot leave the folder.

    Args:
        project_slug: project slug.
        path: relative to the project folder, e.g. 01-topology/mapa.md.
        content: file content.
    """
    full = _project_path(project_slug, path)
    write_text(full, content)
    return {"ok": True, "fullPath": str(full)}


def workspace_read(project_slug: str, path: str, is_archived: bool = False) -> dict:
    """Reads an artifact from the active or archived project.

    Args:
        project_slug: project slug.
        path: relative to the project folder, e.g. 01-topology/mapa.md.
        is_archived: read from workspace/_archive/ instead of the active project.
    """
    full = (
        (ARCHIVE_ROOT / project_slug / path) if is_archived else _project_path(project_slug, path)
    )
    return {"content": read_text(full, f"(file does not exist: {path})")}


def workspace_delete(
    project_slug: str | None = None, path: str | None = None, is_archived: bool = False
) -> dict:
    """Safely deletes an artifact file or an entire project inside workspace/ or workspace/_archive/.

    Args:
        project_slug: project to delete; without `path`, deletes the whole project.
        path: relative file to delete inside the project, or inside the workspace if no slug.
        is_archived: target workspace/_archive/ instead of the active workspace.
    """
    if is_archived:
        if project_slug:
            base = safe_path(ARCHIVE_ROOT, project_slug)
            target = safe_path(base, path) if path else base
        elif path:
            target = safe_path(ARCHIVE_ROOT, path)
        else:
            raise ValueError("Specify an archived project or file to delete")
    elif project_slug:
        target = _project_path(project_slug, path or "")
    elif path:
        target = safe_path(WORKSPACE_ROOT, path)
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
    ARCHIVE_ROOT.mkdir(parents=True, exist_ok=True)
    archiving = action == "archive"

    active_dir = safe_path(WORKSPACE_ROOT, project_slug)
    archived_dir = safe_path(ARCHIVE_ROOT, project_slug)
    src_dir, dest_dir = (active_dir, archived_dir) if archiving else (archived_dir, active_dir)

    if not src_dir.exists():
        raise ValueError(f"Source directory not found: {src_dir}")
    if dest_dir.exists():
        shutil.rmtree(dest_dir)

    if archiving:
        state = read_text(src_dir / "STATE.md")
        if state:
            state = re.sub(r"^status: .*$", "status: concluido", state, flags=re.MULTILINE)
            write_text(src_dir / "STATE.md", f"{state}\n- archived on {date.today().isoformat()}\n")

    shutil.move(str(src_dir), str(dest_dir))

    if archiving:
        clear_now_if_active_project(project_slug)

    verb = "archived as completed" if archiving else "restored"
    return {"ok": True, "message": f"Project {project_slug} {verb} successfully."}


def workspace_list() -> dict:
    """Lists active and archived projects in workspace/ and all their files recursively."""

    def listing(root: Path, skip_underscored: bool) -> list[dict]:
        if not root.exists():
            return []
        return [
            {"slug": e.name, "files": _list_files_recursive(e)}
            for e in sorted(root.iterdir())
            if e.is_dir()
            and not e.name.startswith(".")
            and not (skip_underscored and e.name.startswith("_"))
        ]

    return {
        "projects": listing(WORKSPACE_ROOT, skip_underscored=True),
        "archivedProjects": listing(ARCHIVE_ROOT, skip_underscored=False),
    }


def phase_set(project_slug: str, phase: int, status: str, note: str | None = None) -> dict:
    """Updates the phase (1-4) and status in the project's STATE.md.

    Phases: 1=macro-topology, 2=tracer-bullet, 3=break-edges, 4=architecture-note.

    Args:
        project_slug: project slug.
        phase: 1 to 4.
        status: em-andamento | concluido | pausado.
        note: optional log note.
    """
    state_path = _project_path(project_slug, "STATE.md")
    body = read_text(state_path, _state_template())
    for field, value in (
        ("fase", phase),
        ("status", status),
        ("ultima_sessao", date.today().isoformat()),
    ):
        line = f"{field}: {value}"
        body = re.sub(rf"^{field}: .*$", lambda _, line=line: line, body, flags=re.MULTILINE)
    if note:
        body += f"- fase:{phase} — {note}\n"
    write_text(state_path, body)
    return {"ok": True}
