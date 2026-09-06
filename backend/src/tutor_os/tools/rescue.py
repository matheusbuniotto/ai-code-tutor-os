"""Port of src/mastra/tools/rescue.ts.

Cognitive Rescue Engine: diagnoses real-time blockages against the 2E
profile and prescribes exactly ONE concrete micro-intervention.
"""

from __future__ import annotations

from typing import Literal

Scenario = Literal[
    "stuck_midway",
    "dont_know_how_to_start",
    "infinite_analysis",
    "works_but_could_be_better",
    "not_understanding_anything",
    "flat_tone_iceberg",
    "impostor_syndrome_comparison",
    "perfect_architecture_never_runs",
]

_SCENARIOS: dict[Scenario, dict[str, str]] = {
    "stuck_midway": {
        "realMechanism": "Below-average inhibitory control can't close concurrent loops in working memory. It's not a lack of dopamine.",
        "prescribedAction": "Ask for a 2-minute RAM Dump of whatever's occupying their head right now. Then define a binary 'done when' criterion.",
        "cbtHook": "Postponing (MCT): 'Set that aside for later. Come back to the present now.'",
    },
    "dont_know_how_to_start": {
        "realMechanism": "Lack of initial clarity, OR fear of exposure/error (elevated avoidant trait), OR a previous open loop.",
        "prescribedAction": "Ask which of the 3 it is. Clarity → physical action <2min (open the file and write the title). Fear → declare 'Ugly-draft mode, judgment suspended by design'. Loop → quick RAM dump.",
        "cbtHook": "Defusion (ACT): 'That worry is a transient mental event, not a real prediction of failure.'",
    },
    "infinite_analysis": {
        "realMechanism": "A high-reasoning cognitive profile sees more architecture permutations than average; inhibitory control doesn't filter them.",
        "prescribedAction": "Ask what their FIRST instinct was. Pick at most 3 decision criteria, run the simplest one, and park the rest in the backlog.",
        "cbtHook": "Experiment (CBT): 'Validate the simplest option first to generate empirical evidence before optimizing.'",
    },
    "works_but_could_be_better": {
        "realMechanism": "Relentless standards (schema), OR fear of external criticism.",
        "prescribedAction": "Ask: 'Is the test green and has the external behavior changed? If not → move polishing to the backlog and move on.'",
        "cbtHook": "Defusion (CFT): 'Good enough is whatever produces evidence and closes the cycle.'",
    },
    "not_understanding_anything": {
        "realMechanism": "Zone of Proximal Development (ZPD) set too high, OR self-criticism ('I should understand this fast'), OR depleted battery (elevated fatigue).",
        "prescribedAction": "ZPD too high → smaller chunk + low-level analogy. Self-criticism → defusion. Low reserve → end the session immediately, zero judgment.",
        "cbtHook": "Self-compassion (CFT): 'What would you tell a very smart colleague facing this complexity for the first time?'",
    },
    "flat_tone_iceberg": {
        "realMechanism": "The Iceberg: internal emotional overload with a contained exterior (elevated vulnerability + low external expression).",
        "prescribedAction": "NEVER ask 'are you okay?'. Slow the pace, make space with no pressure, and offer an explicit pause to resume another time.",
        "cbtHook": "Somatic interrupt: shower, silent walk, or NSDR.",
    },
    "impostor_syndrome_comparison": {
        "realMechanism": "Perceived-Competence Distortion (low self-perception vs. actual high achievement). Comparison against narrow 10-year specialists.",
        "prescribedAction": "Present 1 concrete artifact already delivered in past episodes. Don't debate theory; point at the objective data.",
        "cbtHook": "Strategic reframe: 'Your hybrid profile (AI + Data + Product) is an asymmetric superpower.'",
    },
    "perfect_architecture_never_runs": {
        "realMechanism": "Premature-optimization loop trying to eliminate uncertainty on paper.",
        "prescribedAction": "Propose the 'Ugly MVP': 'What's the ugliest, most direct code that runs right now and proves whether the premise works?'",
        "cbtHook": "Tracer bullet rule: 'The compiler/runtime is the only true arbiter.'",
    },
}


def rescue_diagnose(scenario: Scenario, details: str | None = None) -> dict:
    """Diagnoses cognitive/operational blockages using the 2E matrix calibrated to the report.

    Returns the real neuropsychological cause and the ONE immediate prescribed action.

    Args:
        scenario: Observed blockage scenario.
        details: Context or phrase said by the user.
    """
    data = _SCENARIOS[scenario]
    return {"scenario": scenario, **data}
