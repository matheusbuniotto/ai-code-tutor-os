"""Port of src/mastra/workflows/session.ts.

Deterministic phase-tracking state machine for the 4 phases of the Inverted
Pyramid, with human-in-the-loop gates. No Mastra Workflow-with-suspend
primitive exists in pydantic-ai, so this is a small stateless state machine
built directly on `workspace_init`/`phase_set` (`tools/workspace.py`), which
already persist the exact same SPEC.md/STATE.md shape TS's `ensureProject`/
`writePhase` do — no new persistence mechanism needed, just the sequencing
logic TS got from Mastra's step runtime.
"""

from __future__ import annotations

from typing import TypedDict

from tutor_os.tools.workspace import phase_set, workspace_init


class Phase(TypedDict):
    n: int
    id: str
    dir: str
    kickoff: str
    artifact: str


PHASES: tuple[Phase, ...] = (
    {
        "n": 1,
        "id": "macro-topology",
        "dir": "01-topology",
        "kickoff": "Map invariants/trade-offs on PAPER before opening the editor.",
        "artifact": "01-topology/mapa.md",
    },
    {
        "n": 2,
        "id": "tracer-bullet",
        "dir": "02-tracer-bullet",
        "kickoff": (
            "Smallest end-to-end prototype touching the core primitives. "
            "You write it; the scaffolder delivers a skeleton with gaps."
        ),
        "artifact": "02-tracer-bullet/",
    },
    {
        "n": 3,
        "id": "break-edges",
        "dir": "03-break-edges",
        "kickoff": (
            "Break the prototype at its edges (concurrency, malformed data, "
            "scale) to lock in physical intuition."
        ),
        "artifact": "03-break-edges/",
    },
    {
        "n": 4,
        "id": "architecture-note",
        "dir": ".",
        "kickoff": (
            "1 page: invariants / when to use vs. not use / traps. "
            "The Harvester closes the session after this."
        ),
        "artifact": "04-arquitetura-note.md",
    },
)

_PHASES_BY_N: dict[int, Phase] = {p["n"]: p for p in PHASES}
_FINAL_PHASE = 4


def _suspended_response(
    project_slug: str, phase: Phase, completed_phase: int | None = None
) -> dict:
    response = {
        "projectSlug": project_slug,
        "suspended": True,
        "finished": False,
        "phase": phase["n"],
        "phaseId": phase["id"],
        "kickoff": phase["kickoff"],
        "expectedArtifact": phase["artifact"],
        "message": (
            f"Phase {phase['n']}/4 — {phase['id']}. {phase['kickoff']} "
            "Confirm the gate once the criterion is green."
        ),
    }
    if completed_phase is not None:
        response["completedPhase"] = completed_phase
    return response


def session_start(project_slug: str, title: str, objective: str, stack: str) -> dict:
    """Starts (or resumes) an Inverted Pyramid session for a project.

    Ensures the folder/SPEC.md/STATE.md structure via `workspace_init`
    (idempotent — reuses existing files instead of overwriting) and
    returns phase 1's suspended gate: every new session starts suspended,
    waiting for phase 1's criterion to turn green.

    Args:
        project_slug: project slug.
        title: Project title.
        objective: Project objective.
        stack: Technology stack.
    """
    workspace_init(project_slug, title, objective, stack)
    return _suspended_response(project_slug, _PHASES_BY_N[1])


def session_advance(project_slug: str, phase: int, passed: bool, note: str | None = None) -> dict:
    """Advances (or reaffirms) the human gate for a session phase.

    If `passed` is False, returns the current phase's suspended gate again
    without changing STATE.md — the same semantics as Mastra's `suspend()`,
    which only halts execution and persists nothing.

    If `passed` is True, marks the phase as completed and:
    - if `phase` < 4: immediately returns the suspended gate for the NEXT
      phase (equivalent to Mastra's `.then(phaseNStep)` chaining: resuming
      one phase goes straight into the next step's execution, which
      suspends again since it doesn't have `resumeData` yet).
    - if `phase` == 4: closes the session — replicates the TS `finishStep`
      behavior, which runs unconditionally after phase 4's gate and
      REWRITES the status from "concluido" back to "em-andamento" with a
      closing note, signaling that the 4 code phases are ready but the
      session only truly closes once the Harvester runs.

    Args:
        project_slug: project slug.
        phase: phase being confirmed (1 to 4).
        passed: whether the phase's "done when" criterion is satisfied.
        note: optional gate note (recorded in STATE.md's log).
    """
    if phase not in _PHASES_BY_N:
        raise ValueError("phase must be 1, 2, 3, or 4")

    if not passed:
        return _suspended_response(project_slug, _PHASES_BY_N[phase])

    if phase < _FINAL_PHASE:
        phase_set(project_slug, phase, "concluido", note)
        return _suspended_response(project_slug, _PHASES_BY_N[phase + 1], completed_phase=phase)

    phase_set(project_slug, _FINAL_PHASE, "concluido", note)
    phase_set(project_slug, _FINAL_PHASE, "em-andamento", "session closed — run harvest")
    return {
        "projectSlug": project_slug,
        "suspended": False,
        "finished": True,
        "completedPhase": _FINAL_PHASE,
        "summary": f"Project {project_slug}: 4 phases completed. Call the Harvester.",
    }
