"""ASSIGNMENT.md: the structured engineering challenge for a project."""

from __future__ import annotations

from tutor_os.storage import WORKSPACE_ROOT
from tutor_os.tools.arcs import read_arcs_data


def assignment_generate(
    project_slug: str,
    title: str,
    arc_id: str,
    targeted_gap: str,
    predict_phase: str,
    implementation_instrument: str,
    measure_phase: str,
    mutate_phase: str,
    explain_phase: str,
) -> dict:
    """Generates a structured engineering challenge (Assignment Engine).

    Calibrated to expose technical-judgment gaps. Follows the protocol:
    Predict -> Measure -> Mutate -> Explain trade-offs.

    Args:
        project_slug: Slug of the active project.
        title: Title of the engineering challenge.
        arc_id: ID of the matching capability arc (customizable via ARCS.json).
        targeted_gap: Specific capability gap to exercise.
        predict_phase: Prediction questions to answer before running anything.
        implementation_instrument: Minimal code or test instrument to run.
        measure_phase: Exact measurement command and metrics to collect.
        mutate_phase: Parameter variations to stress the system.
        explain_phase: Judgment questions and architecture defense.
    """
    project_dir = WORKSPACE_ROOT / project_slug
    project_dir.mkdir(parents=True, exist_ok=True)

    arcs = read_arcs_data()
    found_arc = next((a for a in arcs if a["id"] == arc_id), None)
    arc_title = found_arc["title"] if found_arc else f"Arc: {arc_id}"

    markdown = f"""# Engineering Assignment: {title}
**Arc:** {arc_title}
**Targeted Gap:** {targeted_gap}
**Principle:** *The implementation is only the instrument. Your engineering judgment is the challenge.*

---

## 1. Prediction Phase (Before Running)
> *Form your hypotheses before looking at any graph or benchmark.*

{predict_phase}

---

## 2. Execution Instrument
```
{implementation_instrument}
```

---

## 3. Measurement Phase (Empirical Evidence)
> *Run the test commands and record the real numbers.*

{measure_phase}

---

## 4. Mutation Phase (Scale and Stress)
> *Vary the parameters to find the inflection/collapse point.*

{mutate_phase}

---

## 5. Explanation & Judgment Phase (Defense)
> *Explain the system's physics based on the observed trade-offs.*

{explain_phase}
"""

    file_path = project_dir / "ASSIGNMENT.md"
    file_path.write_text(markdown, encoding="utf-8")

    return {"ok": True, "filePath": str(file_path), "markdown": markdown}


def assignment_read(project_slug: str) -> dict:
    """Reads the active project's ASSIGNMENT.md file for review or continuation of the challenge.

    Args:
        project_slug: Slug of the project to read the assignment from.
    """
    file_path = WORKSPACE_ROOT / project_slug / "ASSIGNMENT.md"
    if not file_path.exists():
        return {"exists": False, "content": "No active ASSIGNMENT.md in this project."}
    return {"exists": True, "content": file_path.read_text(encoding="utf-8")}
