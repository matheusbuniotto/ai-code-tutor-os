"""Working memory: a Markdown learner profile injected into every agent call.

Distinct from `tools/state.py`'s PROFILE.md, which is read once at session
start and written only by the Harvester. This doc is auto-injected on every
call and any agent may edit it, one section at a time — a whole-document
rewrite would let the model silently drop sections it didn't feel like
repeating.
"""

from __future__ import annotations

from typing import Literal

from tutor_os.config.learner_profile import LearnerProfile, learner_profile, personalize
from tutor_os.markdown import replace_section
from tutor_os.storage import META_DIR, write_text

WORKING_MEMORY_PATH = META_DIR / "WORKING_MEMORY.md"

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
    """Renders the starting document for a learner who has none yet."""
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
    """Reads the persisted doc, initializing it from the template on first use."""
    if WORKING_MEMORY_PATH.exists():
        return WORKING_MEMORY_PATH.read_text(encoding="utf-8")
    doc = build_learner_profile_template(learner_profile)
    write_text(WORKING_MEMORY_PATH, doc)
    return doc


def update_working_memory(section: Section, content: str) -> dict:
    """Updates a section of the Learner Profile (working memory) — call whenever you notice a
    durable fact about the learner (stack level, blockage pattern, microvictory, what
    worked/didn't work). Replaces the entire section with the new content.

    Args:
        section: Section of the Learner Profile to update.
        content: New full content of the section (replaces the previous one).
    """
    header = f"## {_SECTION_HEADERS[section]}"
    write_text(WORKING_MEMORY_PATH, replace_section(get_working_memory(), header, content))
    return {"ok": True}


def inject_working_memory() -> str:
    """Agent instructions hook: re-reads the doc every call, so edits land mid-session."""
    return get_working_memory()
