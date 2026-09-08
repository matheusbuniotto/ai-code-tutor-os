"""3-Gate Leverage Filter: evaluates ideas before they earn execution time.

Protects focus against dispersion into low-leverage work.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from tutor_os.config.learner_profile import personalize
from tutor_os.storage import META_DIR, append_jsonl

GATE_HISTORY_PATH = META_DIR / "GATE_HISTORY.jsonl"

_PERSONAL_GATES_TO_PASS = 3

Context = Literal["work", "personal_study"]
Verdict = Literal["GO", "DELEGATE_AUTOMATE_ASYNC", "POSTPONE_RECORD"]

_ANTI_IMPOSTOR_ANCHOR = personalize(
    "Reality anchor: your cognitive profile learns invariants faster than average. "
    "Your asymmetric advantage is synthesizing {{DOMAIN}}, data, and business ROI — not accumulating isolated syntax."
)


def gate_check(
    context: Context,
    topic: str,
    work_high_abstraction: bool = False,
    work_squad_multiplier: bool = False,
    work_career_moat: bool = False,
    personal_cluster_deepening: bool = False,
    personal_tracer_bullet_fit: bool = False,
    personal_topology_before_syntax: bool = False,
    personal_demand_and_no_abandon_trap: bool = False,
    impostor_doubt_expressed: str | None = None,
) -> dict:
    """Runs the 3-Gate Leverage Filter for Work or Personal Study/Project.

    Returns the structured verdict (GO, DELEGATE_AUTOMATE_ASYNC, POSTPONE_RECORD),
    rationale, and an anti-impostor anchor grounded in concrete evidence when applicable.

    Args:
        context: Context of the demand: corporate work or personal study/lab.
        topic: Theme or idea being evaluated.
        work_high_abstraction: Work Gate 1: high-leverage {{DOMAIN}} work (architecture, data schema, reliability, or evaluation)?
        work_squad_multiplier: Work Gate 2: becomes a playbook, reusable template, or CI/CD guardrail?
        work_career_moat: Work Gate 3: produces a public asset (case study/RFC) with demand through {{CAREER_HORIZON}}?
        personal_cluster_deepening: Study Gate 1: deepens an existing cluster/project (not a from-scratch novelty)?
        personal_tracer_bullet_fit: Study Gate 2: fits in an end-to-end tracer bullet within one focused session?
        personal_topology_before_syntax: Study Gate 3: is the first step mapping invariants on paper?
        personal_demand_and_no_abandon_trap: Study Gate 4: high/stable demand in {{DOMAIN}} through {{CAREER_HORIZON}}, with no history of similar abandonment?
        impostor_doubt_expressed: Competency doubt expressed by the user, if any.
    """
    gates_summary: dict[str, bool] = {}

    if context == "work":
        gates_summary["1_high_level_architecture"] = work_high_abstraction
        gates_summary["2_squad_multiplier"] = work_squad_multiplier
        gates_summary["3_career_asset_2027_2030"] = work_career_moat

        if work_high_abstraction or work_squad_multiplier or work_career_moat:
            verdict: Verdict = "GO"
            rationale = "Passed at least 1 high-value-add work gate."
        else:
            verdict = "DELEGATE_AUTOMATE_ASYNC"
            rationale = "Did not pass the high-leverage gates. Delegate, automate, or handle asynchronously."
    else:
        gates_summary["1_cluster_deepening"] = personal_cluster_deepening
        gates_summary["2_fits_tracer_bullet"] = personal_tracer_bullet_fit
        gates_summary["3_topology_before_syntax"] = personal_topology_before_syntax
        gates_summary["4_future_demand_no_abandonment"] = personal_demand_and_no_abandon_trap

        passed = sum(gates_summary.values())
        if passed >= _PERSONAL_GATES_TO_PASS:
            verdict = "GO"
            rationale = f"Passed {passed}/4 personal-lab gates. Approved for execution in the Inverted Pyramid."
        else:
            verdict = "POSTPONE_RECORD"
            rationale = f"Only passed {passed}/4 gates. Note it in INBOX/ideas and postpone to protect focus."

    anti_impostor_anchor = _ANTI_IMPOSTOR_ANCHOR if impostor_doubt_expressed else None

    verdict_record = {
        "topic": topic,
        "context": context,
        "verdict": verdict,
        "gatesSummary": gates_summary,
        "rationale": rationale,
    }
    append_jsonl(GATE_HISTORY_PATH, {"timestamp": datetime.now(UTC).isoformat(), **verdict_record})

    return {**verdict_record, "antiImpostorAnchor": anti_impostor_anchor, "recorded": True}


gate_check.__doc__ = personalize(gate_check.__doc__)
