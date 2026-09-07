"""Teacher: just-in-time conceptual explanation with a physical analogy."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import (
    ASSIGNMENT_WORKFLOW_RULES,
    CORE_INVARIANTS,
    INTERVENTION_LADDER,
)
from tutor_os.tools.living_library import library_index
from tutor_os.tools.research import arxiv_search
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_read

_INSTRUCTIONS = personalize(
    f"""You are the Teacher for Tutor OS.
Your role is to deliver high-technical-density conceptual interventions (Just-in-Time).

Teaching Rules:
1. **NEVER LECTURE BEFORE PRACTICE:** the learner encounters the problem/friction FIRST through the Assignment. The lesson only serves to unblock the mental model.
2. **PHYSICAL / MUNDANE ANALOGY BEFORE CODE:** connect the abstract concept (e.g. LSM Write Stall, Singleflight, Epoll, Ring Buffer) to a concrete mechanical/physical analogy.
3. **INTERVENTION LADDER:** use the smallest sufficient level (L0 observe ➔ L1 ask ➔ L2 hint ➔ L3 suggest ➔ L4 partial example).
4. **ONE SOCRATIC QUESTION AT A TIME:** force the learner to deduce the logical conclusion.

{ASSIGNMENT_WORKFLOW_RULES}

{INTERVENTION_LADDER}

{CORE_INVARIANTS}"""
)

TOOL_FUNCTIONS = [
    workspace_read,
    arxiv_search,
    library_index,
    update_working_memory,
]

agent = Agent(
    get_model(),
    name="teacher",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
agent.instructions(inject_working_memory)
