"""Living Architecture Library: catalogs the 1-page architecture notes (Phase 4).

Turns finished projects into permanent, citable assets.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from tutor_os.storage import META_DIR, WORKSPACE_ROOT, read_text, write_text

LIBRARY_INDEX_PATH = META_DIR / "LIBRARY.md"
NOTE_FILENAME = "04-arquitetura-note.md"

_HEADER = """# Living Architecture Library

*Permanent collection of architecture notes and system invariants (Phase 4 — Inverted Pyramid).*

"""
_EMPTY = (
    "*(No architecture notes consolidated yet. Complete Phase 4 of a project to index it here.)*\n"
)


def _note_title(content: str, fallback: str) -> str:
    return next(
        (line[2:].strip() for line in content.splitlines() if line.startswith("# ")), fallback
    )


def _project_dirs() -> list[Path]:
    if not WORKSPACE_ROOT.exists():
        return []
    return [
        e for e in sorted(WORKSPACE_ROOT.iterdir()) if e.is_dir() and not e.name.startswith("_")
    ]


def _rebuild_library_index() -> dict:
    notes = []
    for entry in _project_dirs():
        content = read_text(entry / NOTE_FILENAME)
        if not content:
            continue
        notes.append({
            "projectSlug": entry.name,
            "title": _note_title(content, entry.name),
            "path": f"{entry.name}/{NOTE_FILENAME}",
            "snippet": content[:300].replace("\n", " "),
        })

    if notes:
        rows = "".join(
            f"| `{n['projectSlug']}` | **{n['title']}** | [{n['path']}](../{n['path']}) |\n"
            for n in notes
        )
        body = f"| Project | Title | Path |\n|---|---|---|\n{rows}"
    else:
        body = _EMPTY

    write_text(LIBRARY_INDEX_PATH, _HEADER + body)
    return {"totalNotes": len(notes), "notes": notes}


def library_index() -> dict:
    """Lists and indexes all 1-page Architecture Notes created in Phase 4 of the projects.

    Returns the assets cataloged in the Living Architecture Library with their invariants and trade-offs.
    """
    return _rebuild_library_index()


def library_save_note(
    project_slug: str,
    title: str,
    invariants: str,
    when_to_use: str,
    when_not_to_use: str,
    hidden_traps: str,
    proof_artifact: str,
) -> dict:
    """Saves a 1-page Architecture Note (Phase 4 of the Inverted Pyramid).

    Requires a strict format: Core Invariants | When to Use vs. Not Use | Traps and Failures.

    Args:
        project_slug: Project slug (lowercase, hyphens).
        title: Note title.
        invariants: Fundamental invariants and data/execution model.
        when_to_use: Ideal application scenarios.
        when_not_to_use: Contra-indication or overkill scenarios.
        hidden_traps: Traps, scale limits, concurrency failures, or hidden costs.
        proof_artifact: Command or test that proves the physical intuition gained.
    """
    note_content = f"""# Architecture Note: {title}
*Phase 4 — Inverted Pyramid Synthesis | Date: {date.today().isoformat()}*

---

## 1. Core Invariants (First Principles)
{invariants}

---

## 2. When to Use vs. When NOT to Use
### ✅ When to Use
{when_to_use}

### ❌ When NOT to Use (Contra-indications)
{when_not_to_use}

---

## 3. Hidden Traps & Physical Limits (Break Edges Findings)
{hidden_traps}

---

## 4. Proof Artifact
```bash
{proof_artifact}
```
"""

    write_text(WORKSPACE_ROOT / project_slug / NOTE_FILENAME, note_content)
    _rebuild_library_index()
    return {"ok": True, "filePath": f"{project_slug}/{NOTE_FILENAME}"}
