"""Port of src/mastra/tools/observations.ts."""

from __future__ import annotations

import json
from typing import TypedDict

from tutor_os.config.learner_profile import learner_profile
from tutor_os.storage import WORKSPACE_ROOT

OBSERVATIONS_PATH = WORKSPACE_ROOT / "_meta" / "OBSERVATIONS.json"


class Observation(TypedDict):
    tag: str
    text: str


def get_default_observations() -> list[Observation]:
    base: list[Observation] = [
        {
            "tag": "Architecture Method",
            "text": "Inverted Pyramid: 1. Macro Topology → 2. Tracer Bullet → 3. Break Edges → 4. 1-Page Note.",
        },
        {
            "tag": "Cognitive Invariant",
            "text": "Paper-First: topological design and trade-off analysis before coding.",
        },
    ]
    if learner_profile.has_neuropsych_rescue_profile:
        tag_suffix = f" • {learner_profile.cognitive_tag}" if learner_profile.cognitive_tag else ""
        base.insert(
            0,
            {
                "tag": "Profile Calibration",
                "text": f"{learner_profile.name}{tag_suffix}",
            },
        )
    return base


def read_observations() -> list[Observation]:
    try:
        if OBSERVATIONS_PATH.exists():
            return json.loads(OBSERVATIONS_PATH.read_text(encoding="utf-8"))
    except Exception as err:
        print(f"Error reading OBSERVATIONS.json: {err}")
    return get_default_observations()


def write_observations(observations: list[Observation]) -> None:
    OBSERVATIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    OBSERVATIONS_PATH.write_text(
        json.dumps(observations, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def observation_capture(tag: str, text: str) -> dict:
    """Records a short, durable observation about the learner or the project as soon as it's noticed.

    Don't wait for session close or ask permission. Use for concrete facts
    (a decision made, an expressed preference, a project direction change, an
    observed blockage pattern, a demonstrated capability). Do NOT use for
    opinions, unconfirmed hypotheses, or repeats of what's already recorded —
    prefer a few high-quality observations over many trivial ones.

    Args:
        tag: short category, e.g. 'Architecture Decision', 'Preference', 'Blockage Pattern'.
        text: the observation in 1-2 sentences, factual and specific.
    """
    observations = read_observations()
    observations.append({"tag": tag, "text": text})
    write_observations(observations)
    return {"ok": True, "totalObservations": len(observations)}
