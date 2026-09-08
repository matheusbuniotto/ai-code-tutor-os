"""Conversational onboarding: lets the Tutor fill in the Learner Profile itself,
as an alternative to the Settings/wizard UI — same file, same restart caveat.
"""

from __future__ import annotations

from dataclasses import asdict

from tutor_os.config.learner_profile import read_learner_profile, write_learner_profile


def profile_onboarding_status() -> dict:
    """Reports whether the Learner Profile still looks generic (no name/domain set yet).

    Call this once at the start of a new thread (alongside meta_overview) to decide
    whether to ask onboarding questions before diving into the task.
    """
    profile = read_learner_profile()
    incomplete = (not profile.name or profile.name == "you") and not profile.domain_label
    return {"incomplete": incomplete, "profile": asdict(profile)}


def profile_onboarding_update(
    name: str | None = None,
    domain_label: str | None = None,
    work_role: str | None = None,
    career_horizon: str | None = None,
) -> dict:
    """Saves Learner Profile fields the learner just answered conversationally.

    Only pass fields the learner actually answered — omit the rest so they're left
    untouched. This drives the 3-Gate Filter and how agents address the learner.
    Full effect (agent instructions) only lands after the next server restart —
    tell the learner that plainly, don't imply it's instant.

    Args:
        name: Learner's name/nickname.
        domain_label: Field/interest area (e.g. "Backend & Distributed Systems", "Applied ML").
        work_role: Career context for the Work 3-Gate Filter (e.g. "Fintech Tech Lead"). Optional.
        career_horizon: Demand horizon for the 3-Gate Filter (e.g. "2027-2030"). Optional.
    """
    updates = {
        k: v
        for k, v in {
            "name": name,
            "domain_label": domain_label,
            "work_role": work_role,
            "career_horizon": career_horizon,
        }.items()
        if v is not None
    }
    profile = write_learner_profile(updates)
    return {"ok": True, "profile": asdict(profile)}
