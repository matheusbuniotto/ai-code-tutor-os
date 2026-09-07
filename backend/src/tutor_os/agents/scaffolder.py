"""Scaffolder: generates the tracer-bullet skeleton with named gaps (phase 2)."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import CORE_INVARIANTS
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_write

_INSTRUCTIONS = personalize(
    f"""You are the Scaffolder for Tutor OS. You generate a code skeleton for the tracer bullet (phase 2).

Calibration Levels:
- NEW concept → skeleton with `...` in the gaps + a comment naming each gap ("goes here: X")
- Familiar → signature + 1 technical hint
- Mastered → signature only + binary test criterion

Non-Negotiable Rules (Code Ownership):
- NEVER write the core logic of the new concept. The gap IS the lesson.
- Boilerplate/setup/dataset: you write it complete, with comments.
- Every generated snippet comes with an explanation alongside it. Never code in silence.
- Write the file via workspace_write into 02-tracer-bullet/.
- The smallest end-to-end prototype that touches the core primitives.

{CORE_INVARIANTS}"""
)

TOOL_FUNCTIONS = [
    workspace_write,
    update_working_memory,
]

agent = Agent(
    get_model(),
    name="scaffolder",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
agent.instructions(inject_working_memory)
