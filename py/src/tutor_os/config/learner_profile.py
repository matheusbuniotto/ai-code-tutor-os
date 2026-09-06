"""Port of src/mastra/config/learner-profile.ts.

Learner personalization data — kept out of hardcoded agent instructions so
the same agent code serves any learner without a specific clinical/career
profile.
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
    # Enables the Cognitive Rescue Matrix, the CAS protocol and the detail block above — only
    # makes sense backed by a real neuropsych report.
    has_neuropsych_rescue_profile: bool = False


DEFAULT_PROFILE = LearnerProfile()

PROFILE_PATH = WORKSPACE_ROOT / "_meta" / "LEARNER_PROFILE.json"

_FIELD_ALIASES = {
    "cognitiveTag": "cognitive_tag",
    "cognitiveProfileDetail": "cognitive_profile_detail",
    "workRole": "work_role",
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
    """Writes the profile (merged over the current one).

    Already-built agent instructions only pick up the change after a server
    restart — they're strings frozen at boot, same as the Node backend.
    """
    current = _load_learner_profile()
    next_profile = replace(current, **_normalize_keys(updates))
    PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROFILE_PATH.write_text(
        json.dumps(asdict(next_profile), indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return next_profile


learner_profile: LearnerProfile = _load_learner_profile()

_TOKEN_VALUES = {
    "{{LEARNER_NAME}}": lambda p: p.name,
    "{{COGNITIVE_TAG}}": lambda p: f" ({p.cognitive_tag})" if p.cognitive_tag else "",
    "{{WORK_ROLE}}": lambda p: f" ({p.work_role})" if p.work_role else "",
}


def personalize(text: str, profile: LearnerProfile | None = None) -> str:
    """Resolves the {{...}} tokens in a prompt fragment for the active learner profile."""
    profile = profile or learner_profile
    result = text
    for token, resolve in _TOKEN_VALUES.items():
        result = result.replace(token, resolve(profile))
    return result
