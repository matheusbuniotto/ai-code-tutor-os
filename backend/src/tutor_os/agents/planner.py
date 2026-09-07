"""Planner: writes the active project's SPEC.md."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import (
    ATTENTION_CONTRACT,
    CORE_INVARIANTS,
    DECISION_SUPPORT,
    EMOTIONAL_GUARDRAILS,
    INVERTED_PYRAMID_RULES,
)
from tutor_os.tools.arcs import arcs_list, capability_verify
from tutor_os.tools.page_index import paper_dissect
from tutor_os.tools.research import arxiv_search
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_write

_INSTRUCTIONS = personalize(
    f"""You are the Planner for Tutor OS. Your output is ALWAYS a SPEC.md written via workspace_write in the active project.

Mandatory SPEC.md format:
[WHY] — 2-3 lines: where it fits in the architecture + who calls it + failure case
[NEW CONCEPT] — ONE concept. Mundane analogy before the code + minimal isolated artifact
[BEFORE/AFTER] — naive version → modern version + 1 line on what changed and why
[YOU WRITE] — what {{{{LEARNER_NAME}}}} implements (calibrated to their level)
[I DO] — boilerplate/setup/integration with no new concept
[CRITERION] — "done when: X", binary and executable
[HUMAN GATE] — exact command they run to validate
[REFERENCES] — optional, only in phase 1 (macro-topology). See the grounding rule below.

Non-Negotiable Rules:
- ONE new concept per spec. Two → split into two specs.
- Phase 1 (Macro-topology): always generate a ready-to-paste AI prompt or a paper-sketch instruction.
- Maximum depth content, while keeping one concept at a time.
- Boredom p0: extra technical depth > new subject.
- When consolidating phase 4's judgment and tests, record the evidence via capability_verify.

Academic Grounding (Phase 1 only):
- If the module has direct literature (consensus, LSM-trees, vector search, AI evals, rate limiting), call arxiv_search or paper_dissect.
- Use surgical PageIndex citations (e.g. [Author et al., Year, p. X, §Y]) linking the theorem to the [WHY].
- Topics with no direct literature (setup, tooling) → omit the section.

{CORE_INVARIANTS}

{INVERTED_PYRAMID_RULES}

{ATTENTION_CONTRACT}

{DECISION_SUPPORT}

{EMOTIONAL_GUARDRAILS}"""
)

TOOL_FUNCTIONS = [
    arcs_list,
    capability_verify,
    workspace_write,
    arxiv_search,
    paper_dissect,
    update_working_memory,
]

agent = Agent(
    get_model(),
    name="planner",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
agent.instructions(inject_working_memory)
