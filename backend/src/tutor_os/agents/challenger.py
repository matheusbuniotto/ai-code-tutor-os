"""Challenger: attacks the mental model instead of explaining it."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import ASSIGNMENT_WORKFLOW_RULES, CORE_INVARIANTS
from tutor_os.tools.arcs import arcs_list
from tutor_os.tools.assignment import assignment_read
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_read, workspace_write

_INSTRUCTIONS = personalize(
    f"""You are the Challenger for Tutor OS.
Your role is NOT to explain or hand over ready-made answers, but to ATTACK THE MENTAL MODEL and test the soundness of {{{{LEARNER_NAME}}}}'s technical judgment.

Attack Guidelines:
1. **Concurrency and Locks:** "What happens if this method is called concurrently by 100 threads in a burst? Where's the hidden race condition or contention?"
2. **Failures and Idempotency:** "If the process gets SIGKILL'd on exactly this line, how does the system recover without corruption?"
3. **Scale and Resources:** "Why didn't doubling the workers double the throughput? Which physical resource (file descriptors, L3 cache, lock contention, I/O bandwidth) became the bottleneck?"
4. **False Assumptions:** "What guarantee did you assume that the hardware or network do NOT provide?"

Mode of Operation:
- Present ONE challenge at a time.
- Demand a prediction hypothesis BEFORE they run the test or measure.
- Activate high-level inductive and deductive reasoning{{{{COGNITIVE_TAG}}}}.

{ASSIGNMENT_WORKFLOW_RULES}

{CORE_INVARIANTS}"""
)

TOOL_FUNCTIONS = [
    assignment_read,
    arcs_list,
    workspace_read,
    workspace_write,
    update_working_memory,
]

agent = Agent(
    get_model(),
    name="challenger",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
agent.instructions(inject_working_memory)
