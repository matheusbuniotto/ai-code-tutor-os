"""Semantic memory: short, durable facts about the learner and their projects."""

from __future__ import annotations

from typing import TypedDict

from tutor_os.config.learner_profile import learner_profile
from tutor_os.storage import META_DIR, read_json, write_json

OBSERVATIONS_PATH = META_DIR / "OBSERVATIONS.json"


class Observation(TypedDict):
    tag: str
    text: str


def get_default_observations() -> list[Observation]:
    defaults: list[Observation] = [
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
        suffix = f" • {learner_profile.cognitive_tag}" if learner_profile.cognitive_tag else ""
        defaults.insert(
            0, {"tag": "Profile Calibration", "text": f"{learner_profile.name}{suffix}"}
        )
    return defaults


def read_observations() -> list[Observation]:
    stored = read_json(OBSERVATIONS_PATH)
    return get_default_observations() if stored is None else stored


def write_observations(observations: list[Observation]) -> None:
    write_json(OBSERVATIONS_PATH, observations)


def _check_index(observations: list[Observation], index: int) -> None:
    if not 0 <= index < len(observations):
        raise ValueError(f"Observation index out of range: {index}")


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
    new: Observation = {"tag": tag, "text": text}
    observations = [*read_observations(), new]
    write_observations(observations)
    return {"ok": True, "totalObservations": len(observations)}


def observation_update(index: int, tag: str, text: str) -> dict:
    """Updates an existing observation in place by its position in the list."""
    observations = read_observations()
    _check_index(observations, index)
    updated: Observation = {"tag": tag, "text": text}
    observations[index] = updated
    write_observations(observations)
    return {"ok": True, "observations": observations}


def observation_delete(index: int) -> dict:
    """Deletes an observation by its position in the list."""
    observations = read_observations()
    _check_index(observations, index)
    del observations[index]
    write_observations(observations)
    return {"ok": True, "observations": observations}


def observations_reset() -> dict:
    """Resets semantic observations back to the default calibration set."""
    defaults = get_default_observations()
    write_observations(defaults)
    return {"ok": True, "observations": defaults}
