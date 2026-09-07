"""Meta-learning overview: the NOW focus file, arc progress, and project state."""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path

from tutor_os.storage import META_DIR, WORKSPACE_ROOT, read_json, read_text, write_text
from tutor_os.tools.arcs import read_arcs_data

NOW_PATH = META_DIR / "NOW.md"
OBS_PATH = META_DIR / "OBSERVATIONS.json"
EXP_PATH = META_DIR / "EXPERIMENTS.json"


def _empty_now_content() -> str:
    return f"""# NOW — Active Focus

**Project:** none
**Mission:** (no active mission)
**Phase:** 1/4
**Date:** {date.today().isoformat()}

## Observable Objective
No active project right now

## Next Action (< 2min)
Define a new mission when there's demand for one
"""


def _extract_now_project_slug(now_content: str) -> str | None:
    m = re.search(r"\*\*Project:\*\*\s*(\S+)", now_content)
    return m.group(1) if m else None


def clear_now_if_active_project(slug: str) -> None:
    """Clears the focus when the project it points at is deleted or archived."""
    if _extract_now_project_slug(read_text(NOW_PATH)) == slug:
        write_text(NOW_PATH, _empty_now_content())


def _count(path: Path, key: str) -> int:
    """Counts a stored collection, tolerating both a bare list and a {key: [...]} wrapper."""
    data = read_json(path, [])
    return len(data if isinstance(data, list) else data.get(key, []))


def _project_summary(entry: Path) -> dict:
    spec = read_text(entry / "SPEC.md")
    title_match = re.search(
        r"^#\s*SPEC\s*—\s*(?:Projeto\s*\S+\s*\(([^)]+)\)|([^\n]+))", spec, re.MULTILINE
    )
    title = entry.name
    if title_match:
        title = (title_match.group(1) or title_match.group(2) or entry.name).strip()

    state = read_text(entry / "STATE.md")
    phase_match = re.search(r"fase:\s*(\d+)", state, re.IGNORECASE)
    status_match = re.search(r"status:\s*([^\n]+)", state, re.IGNORECASE)

    return {
        "slug": entry.name,
        "title": title,
        "phase": int(phase_match.group(1)) if phase_match else 1,
        "status": status_match.group(1).strip() if status_match else "in_progress",
        "hasAssignment": (entry / "ASSIGNMENT.md").exists(),
    }


def meta_overview() -> dict:
    """Returns the full Meta-Learning overview: NOW.md, Arcs, Projects, and Tiny Experiments/observations."""
    now_content = read_text(NOW_PATH)

    arcs = read_arcs_data()
    capabilities = [(a, c) for a in arcs for c in a.get("capabilities", [])]
    pending = [
        {"arcId": a["id"], "capId": c["id"], "title": c["title"]}
        for a, c in capabilities
        if not c.get("verified")
    ]

    projects = (
        [
            _project_summary(entry)
            for entry in sorted(WORKSPACE_ROOT.iterdir())
            if entry.is_dir() and not entry.name.startswith((".", "_"))
        ]
        if WORKSPACE_ROOT.exists()
        else []
    )

    now_slug = _extract_now_project_slug(now_content)
    now_stale = bool(
        now_slug and now_slug != "none" and not any(p["slug"] == now_slug for p in projects)
    )

    return {
        "now": now_content,
        "arcsSummary": {
            "totalArcs": len(arcs),
            "totalCapabilities": len(capabilities),
            "verifiedCapabilities": len(capabilities) - len(pending),
            "pendingCapabilities": pending[:8],
        },
        "projects": projects,
        "experimentsCount": _count(EXP_PATH, "experiments"),
        "observationsCount": _count(OBS_PATH, "observations"),
        "nowStale": now_stale,
    }


def meta_set_now(
    project_slug: str, mission: str, objective: str, next_action: str, phase: int = 1
) -> dict:
    """Updates the NOW.md file (active focus) with active project, mission, objective, and next action <2min.

    Args:
        project_slug: Slug of the active project in the workspace.
        mission: Title of the active mission.
        objective: Observable objective / success criterion.
        next_action: Next physical micro-action <2min.
        phase: Current phase (1 to 4).
    """
    content = f"""# NOW — Active Focus

**Project:** {project_slug}
**Mission:** {mission}
**Phase:** {phase}/4
**Date:** {date.today().isoformat()}

## Observable Objective
{objective}

## Next Action (< 2min)
{next_action}
"""
    write_text(NOW_PATH, content)
    return {"ok": True, "content": content}
