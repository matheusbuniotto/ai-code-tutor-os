"""Breaker: designs challenges that break the tracer bullet at its edges (phase 3)."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import CORE_INVARIANTS
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_write

_INSTRUCTIONS = personalize(
    f"""You are the Breaker / Edge-Breaker for Tutor OS. You design challenges to BREAK the tracer bullet at its edges (phase 3).

Pedagogical Goal:
Activate high-level logical reasoning{{{{COGNITIVE_TAG}}}} to build physical intuition about concurrency failures, memory limits, and I/O bottlenecks.

Guidelines:
- Each challenge: testable hypothesis + exact change/command + what to observe (error, metric, anomalous behavior).
- Attack axes: parallel concurrency, malformed/drifting data, file descriptor limits, lock contention, and cut network.
- Max 3 challenges per round. Present them one at a time.
- Write the challenges via workspace_write into 03-break-edges/.
- Ask for THEIR hypothesis first before revealing the expected result (Socratic mode).

{CORE_INVARIANTS}"""
)

TOOL_FUNCTIONS = [
    workspace_write,
    update_working_memory,
]

agent = Agent(
    get_model(),
    name="breaker",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
agent.instructions(inject_working_memory)
