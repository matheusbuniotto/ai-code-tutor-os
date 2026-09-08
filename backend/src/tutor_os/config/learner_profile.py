"""Learner personalization, kept out of agent instructions.

The same agent code serves any learner; `personalize()` resolves the {{...}}
tokens at call time.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, replace

from tutor_os.storage import WORKSPACE_ROOT


@dataclass
class LearnerProfile:
    name: str = "you"
    # Short clinical/cognitive label (e.g. "GAI elevado, percentil alto, 2E: AH/SD..."). Empty = omitted from prompts.
    cognitive_tag: str = ""
    # Free-form detail (report, indices, percentiles) injected into working memory when
    # has_neuropsych_rescue_profile=True. Editable in Settings — no code change needed.
    cognitive_profile_detail: str = ""
    # Career-context label for the 3-Gate Filter (e.g. "Fintech Tech Lead"). Empty = omitted.
    work_role: str = ""
    # Field/interest area driving the 3-Gate Filter and skill-arc wording (e.g. "Backend &
    # Distributed Systems", "Applied ML", "Frontend Engineering"). Empty = generic "your field".
    domain_label: str = ""
    # Horizon used by the 3-Gate Filter's career/demand gates (e.g. "2027-2030"). Empty = generic
    # "the coming years".
    career_horizon: str = ""
    # Enables the Cognitive Rescue Matrix, the CAS protocol and the detail block above — only
    # makes sense backed by a real neuropsych report.
    has_neuropsych_rescue_profile: bool = False


DEFAULT_PROFILE = LearnerProfile()

PROFILE_PATH = WORKSPACE_ROOT / "_meta" / "LEARNER_PROFILE.json"

_FIELD_ALIASES = {
    "cognitiveTag": "cognitive_tag",
    "cognitiveProfileDetail": "cognitive_profile_detail",
    "workRole": "work_role",
    "domainLabel": "domain_label",
    "careerHorizon": "career_horizon",
    "hasNeuropsychRescueProfile": "has_neuropsych_rescue_profile",
}


def _normalize_keys(raw: dict) -> dict:
    return {_FIELD_ALIASES.get(k, k): v for k, v in raw.items()}


def _load_learner_profile() -> LearnerProfile:
    if not PROFILE_PATH.exists():
        return DEFAULT_PROFILE
    try:
        raw = json.loads(PROFILE_PATH.read_text(encoding="utf-8"))
        return replace(DEFAULT_PROFILE, **_normalize_keys(raw))
    except Exception as err:
        print(f"Error reading LEARNER_PROFILE.json, using generic profile: {err}")
        return DEFAULT_PROFILE


def read_learner_profile() -> LearnerProfile:
    """Reads the profile straight from disk — used by the frontend config API (always current)."""
    return _load_learner_profile()


def write_learner_profile(updates: dict) -> LearnerProfile:
    """Writes the profile (merged over the current one) and updates active runtime memory."""
    global learner_profile
    current = _load_learner_profile()
    next_profile = replace(current, **_normalize_keys(updates))
    PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROFILE_PATH.write_text(
        json.dumps(asdict(next_profile), indent=2, ensure_ascii=False), encoding="utf-8"
    )
    learner_profile = next_profile
    return next_profile


def reload_learner_profile() -> LearnerProfile:
    """Reloads the profile from disk and updates runtime state."""
    global learner_profile
    learner_profile = _load_learner_profile()
    return learner_profile


def reset_learner_profile() -> LearnerProfile:
    """Resets the profile to blank default state on disk and in runtime memory."""
    global learner_profile
    if PROFILE_PATH.exists():
        PROFILE_PATH.unlink()
    learner_profile = DEFAULT_PROFILE
    PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROFILE_PATH.write_text(
        json.dumps(asdict(DEFAULT_PROFILE), indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return learner_profile


learner_profile: LearnerProfile = _load_learner_profile()

_TOKEN_VALUES = {
    "{{LEARNER_NAME}}": lambda p: p.name,
    "{{COGNITIVE_TAG}}": lambda p: f" ({p.cognitive_tag})" if p.cognitive_tag else "",
    "{{WORK_ROLE}}": lambda p: f" ({p.work_role})" if p.work_role else "",
    "{{DOMAIN}}": lambda p: p.domain_label or "your field",
    "{{CAREER_HORIZON}}": lambda p: p.career_horizon or "the coming years",
}


def personalize(text: str, profile: LearnerProfile | None = None) -> str:
    """Resolves the {{...}} tokens in a prompt fragment for the active learner profile."""
    profile = profile or learner_profile
    result = text
    for token, resolve in _TOKEN_VALUES.items():
        result = result.replace(token, resolve(profile))
    return result
