"""Port of src/mastra/tools/living-library.ts.

Living Architecture Library: catalogs and synthesizes the 1-page architecture
notes (Phase 4 of the Inverted Pyramid). Converts learning into permanent
public/professional assets.
"""

from __future__ import annotations

from tutor_os.storage import WORKSPACE_ROOT

LIBRARY_INDEX_PATH = WORKSPACE_ROOT / "_meta" / "LIBRARY.md"


def _rebuild_library_index() -> dict:
    if not WORKSPACE_ROOT.exists():
        return {"totalNotes": 0, "notes": []}

    notes: list[dict] = []
    for entry in sorted(WORKSPACE_ROOT.iterdir()):
        if not entry.is_dir() or entry.name.startswith("_"):
            continue
        # Filename kept as-is (on-disk artifact convention, not translated —
        # see py/README.md i18n scope note / delegation.py's sibling files).
        note_path = entry / "04-arquitetura-note.md"
        if note_path.exists():
            content = note_path.read_text(encoding="utf-8")
            title = entry.name
            for line in content.splitlines():
                if line.startswith("# "):
                    title = line[2:].strip()
                    break
            notes.append({
                "projectSlug": entry.name,
                "title": title,
                "path": f"{entry.name}/04-arquitetura-note.md",
                "snippet": content[:300].replace("\n", " "),
            })

    markdown_index = "# Living Architecture Library\n\n*Permanent collection of architecture notes and system invariants (Phase 4 — Inverted Pyramid).*\n\n"
    if not notes:
        markdown_index += "*(No architecture notes consolidated yet. Complete Phase 4 of a project to index it here.)*\n"
    else:
        markdown_index += "| Project | Title | Path |\n|---|---|---|\n"
        for n in notes:
            markdown_index += (
                f"| `{n['projectSlug']}` | **{n['title']}** | [{n['path']}](../{n['path']}) |\n"
            )

    LIBRARY_INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    LIBRARY_INDEX_PATH.write_text(markdown_index, encoding="utf-8")

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
    project_dir = WORKSPACE_ROOT / project_slug
    project_dir.mkdir(parents=True, exist_ok=True)

    from datetime import date

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

    # Filename kept as-is (on-disk artifact convention shared with session.py).
    note_path = project_dir / "04-arquitetura-note.md"
    note_path.write_text(note_content, encoding="utf-8")

    _rebuild_library_index()

    return {"ok": True, "filePath": f"{project_slug}/04-arquitetura-note.md"}
