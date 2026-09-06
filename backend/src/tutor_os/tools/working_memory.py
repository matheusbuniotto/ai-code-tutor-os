"""Port of the `workingMemory` feature of `src/mastra/memory.ts`.

Mastra's `Memory` object auto-injects a resource-scoped Markdown "Learner
Profile" document into every agent call and exposes a native
`updateWorkingMemory` tool the LLM can call to edit it turn-by-turn.
pydantic-ai has no built-in equivalent, so this reimplements the same
observable behavior: a persisted Markdown doc, injected via
`@agent.instructions` on every call (`inject_working_memory`), and an
update tool (`update_working_memory`) registered on every agent's
TOOL_FUNCTIONS.

Deviates from Mastra in one way: Mastra's native tool replaces the WHOLE
document in one shot (`{memory: string}` schema). This instead ports the
section-scoped regex-replace convention `tools/state.py` already
established for PROFILE.md, since letting the LLM resend the entire
document every turn risks silent truncation of sections it doesn't feel
like repeating.

This file's document (`WORKING_MEMORY.md`) is deliberately separate from
`tools/state.py`'s `PROFILE.md` — same as in TS, where `memory.ts`'s
workingMemory template and `state.ts`'s PROFILE.md are two independent
systems: PROFILE.md is read once at session start via an explicit
`state_read` tool call and written only by the Harvester, while
WORKING_MEMORY.md is auto-injected into every single call and editable by
any agent.
"""

from __future__ import annotations

import re
from typing import Literal

from tutor_os.config.learner_profile import LearnerProfile, learner_profile, personalize
from tutor_os.storage import WORKSPACE_ROOT

WORKING_MEMORY_PATH = WORKSPACE_ROOT / "_meta" / "WORKING_MEMORY.md"

Section = Literal[
    "cognitive-affective-profile",
    "levels-by-stack",
    "easy-calibration",
    "blockage-patterns",
    "rewards-policy",
    "microvictories",
]

_SECTION_HEADERS: dict[Section, str] = {
    "cognitive-affective-profile": "Cognitive & Affective Profile",
    "levels-by-stack": "Levels by Stack",
    "easy-calibration": '"Easy" Calibration (Boilerplate → Tutor/Driver executes)',
    "blockage-patterns": "Observed Blockage Patterns",
    "rewards-policy": "Rewards & Leverage Policy",
    "microvictories": "Microvictories & Recent Reality Checks",
}


def build_learner_profile_template(profile: LearnerProfile) -> str:
    """Port of `buildLearnerProfileTemplate()` in `src/mastra/memory.ts`."""
    if profile.has_neuropsych_rescue_profile:
        tag = f" ({profile.cognitive_tag})" if profile.cognitive_tag else ""
        detail = (
            profile.cognitive_profile_detail
            or "<!-- edit in Settings > Learner Profile > Detailed Cognitive Profile -->"
        )
        cognitive_section = (
            f"## Cognitive & Affective Profile{tag}\n{detail}\n"
            "<!-- Harvester adds cognitive-style observations as evidence appears -->\n"
        )
    else:
        cognitive_section = (
            "## Cognitive & Affective Profile\n"
            "<!-- Harvester records cognitive-style observations as evidence appears -->\n"
        )

    template = f"""# Learner Profile — {{{{LEARNER_NAME}}}}
*Dynamic profile — updated as evidence appears in the session*

{cognitive_section}
## Operational Invariants (Non-Negotiable)
1. Never clock time ("2h", "30min"). Use atomic units ("one session", "one phase cycle").
2. Inverted Pyramid: Macro Topology (1) → Tracer Bullet (2) → Break Edges (3) → 1-Page Architecture Note (4).
3. Code Ownership: {{{{LEARNER_NAME}}}} writes the core code in Phase 2. The AI only provides an integration skeleton with named gaps.
4. Paper-First Topology: sketch the invariants on paper before opening the IDE or coding.
5. Finding facts is the AI's job: read the state and episodes before speaking. NEVER ask "where did we leave off?".
6. Zero blame / no moralizing: abandonment is empirical data. Record why and move on.
7. One single conversational voice: Tutor/Navigator interacts by default.

## Levels by Stack
<!-- updated via update_working_memory: stack → beginner/intermediate/advanced + evidence -->

## "Easy" Calibration (Boilerplate → Tutor/Driver executes)
<!-- e.g. setup, pyproject, build scripts, raw data integration -->

## Observed Blockage Patterns
<!-- recorded via update_working_memory as recurring patterns appear, with date -->

## Rewards & Leverage Policy
<!-- What worked / what didn't in this phase -->

## Microvictories & Recent Reality Checks
✅
"""
    return personalize(template, profile)


def get_working_memory() -> str:
    """Reads the persisted working memory doc, initializing it from the template on first use."""
    if WORKING_MEMORY_PATH.exists():
        return WORKING_MEMORY_PATH.read_text(encoding="utf-8")
    doc = build_learner_profile_template(learner_profile)
    WORKING_MEMORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    WORKING_MEMORY_PATH.write_text(doc, encoding="utf-8")
    return doc


def update_working_memory(section: Section, content: str) -> dict:
    """Updates a section of the Learner Profile (working memory) — call whenever you notice a
    durable fact about the learner (stack level, blockage pattern, microvictory, what
    worked/didn't work). Replaces the entire section with the new content.

    Args:
        section: Section of the Learner Profile to update.
        content: New full content of the section (replaces the previous one).
    """
    body = get_working_memory()
    header = f"## {_SECTION_HEADERS[section]}"
    # `[^\n]*` tolerates a header line with a trailing suffix (e.g. "Cognitive
    # & Affective Profile (elevated GAI, ...)" when a cognitive_tag is set) —
    # match on the header prefix, not the exact full line.
    pattern = re.compile(rf"{re.escape(header)}[^\n]*\n[\s\S]*?(?=\n## |$)")
    replacement = f"{header}\n{content}\n"
    body = (
        pattern.sub(replacement, body, count=1)
        if pattern.search(body)
        else f"{body}\n{replacement}"
    )
    WORKING_MEMORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    WORKING_MEMORY_PATH.write_text(body, encoding="utf-8")
    return {"ok": True}


def inject_working_memory() -> str:
    """Registered as a dynamic `@agent.instructions` hook on every agent — returns the
    current working memory doc fresh on every call (unlike `personalize()`'d static
    instructions, which freeze at agent-construction/server-boot time)."""
    return get_working_memory()
