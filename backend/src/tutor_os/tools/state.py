"""The learner's dynamic profile in PROFILE.md.

Read by any agent at session start (Step 0); written only by the Harvester.
"""

from __future__ import annotations

from typing import Literal, get_args

from tutor_os.markdown import replace_section
from tutor_os.storage import META_DIR, read_text, write_text

PROFILE_PATH = META_DIR / "PROFILE.md"

Section = Literal[
    "levels-by-stack",
    "easy-boilerplate",
    "blockage-patterns",
    "rewards-policy",
    "microvictories",
]

_EMPTY_PROFILE = "# PROFILE\n(empty — first session; calibrate before creating a spec)"


def state_read() -> dict:
    """Mandatory session Step 0: returns the learner's dynamic profile.

    (levels, blockage patterns, rewards, microvictories). Combine with working
    memory. NEVER ask 'where did we leave off' — this file answers that.
    """
    return {"profile": read_text(PROFILE_PATH, _EMPTY_PROFILE)}


def state_update(section: Section, content: str) -> dict:
    """[HARVESTER ONLY] Updates a section of the dynamic profile.

    Replaces the entire section with the new content.
    """
    blank = "\n".join(f"## {s}\n" for s in get_args(Section))
    body = read_text(PROFILE_PATH, f"# PROFILE (dynamic)\n\n{blank}")
    write_text(PROFILE_PATH, replace_section(body, f"## {section}", content))
    return {"ok": True}
