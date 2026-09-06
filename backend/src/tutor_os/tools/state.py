"""Port of src/mastra/tools/state.ts.

Learner's dynamic state lives in workspace/_meta/PROFILE.md. Read: any agent
(state_read at session start — Step 0). Write: ONLY the Harvester
(single-writer principle) via state_update.
"""

from __future__ import annotations

import re
from typing import Literal

from tutor_os.storage import WORKSPACE_ROOT

PROFILE_PATH = WORKSPACE_ROOT / "_meta" / "PROFILE.md"

Section = Literal[
    "levels-by-stack",
    "easy-boilerplate",
    "blockage-patterns",
    "rewards-policy",
    "microvictories",
]

_SECTIONS: tuple[Section, ...] = (
    "levels-by-stack",
    "easy-boilerplate",
    "blockage-patterns",
    "rewards-policy",
    "microvictories",
)


def state_read() -> dict:
    """Mandatory session Step 0: returns the learner's dynamic profile.

    (levels, blockage patterns, rewards, microvictories). Combine with working
    memory. NEVER ask 'where did we leave off' — this file answers that.
    """
    if PROFILE_PATH.exists():
        profile = PROFILE_PATH.read_text(encoding="utf-8")
    else:
        profile = "# PROFILE\n(empty — first session; calibrate before creating a spec)"
    return {"profile": profile}


def state_update(section: Section, content: str) -> dict:
    """[HARVESTER ONLY] Updates a section of the dynamic profile.

    Replaces the entire section with the new content.
    """
    if PROFILE_PATH.exists():
        body = PROFILE_PATH.read_text(encoding="utf-8")
    else:
        sections_block = "\n".join(f"## {s}\n" for s in _SECTIONS)
        body = f"# PROFILE (dynamic)\n\n{sections_block}"

    header = f"## {section}"
    pattern = re.compile(rf"{re.escape(header)}\n[\s\S]*?(?=\n## |$)")
    replacement = f"{header}\n{content}\n"
    body = (
        pattern.sub(replacement, body, count=1)
        if pattern.search(body)
        else f"{body}\n{replacement}"
    )

    PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROFILE_PATH.write_text(body, encoding="utf-8")
    return {"ok": True}
