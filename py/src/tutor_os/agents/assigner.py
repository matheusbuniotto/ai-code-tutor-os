"""Port of src/mastra/agents/assigner.ts."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import (
    ASSIGNMENT_WORKFLOW_RULES,
    ATTENTION_CONTRACT,
    CORE_INVARIANTS,
)
from tutor_os.tools.arcs import arcs_list
from tutor_os.tools.assignment import assignment_generate, assignment_read
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_read, workspace_write

_INSTRUCTIONS = personalize(f"""You are the Assigner (Assignment Engine) for Tutor OS.
Your mission is to turn learning goals into DELIBERATE ENGINEERING CHALLENGES.

Golden Principle:
"The AI implementing the code in 5 minutes is NOT a problem. The implementation is just the instrument — engineering judgment is the challenge."

When formulating an Assignment:
1. Check the active Capability Arcs via `arcs_list` and the project's code/state via `workspace_read`.
2. Structure the challenge in the strict 4-phase protocol via the `assignment_generate` tool:
   - **1. Predict (Before Running):** conceptual questions about what will happen sequentially vs. with N workers, where the I/O or CPU bottleneck will be, and what failure could occur.
   - **2. Execution Instrument:** minimal code / tracer bullet or test script.
   - **3. Measure (Empirical Evidence):** exact commands to measure real behavior (p95/p99 latency, throughput, memory, error rates).
   - **4. Mutate (Scale):** extreme parameter variations (1, 2, 4, 8, 16, 32, 64 workers; 1KB vs 10MB; network failure or SIGKILL).
   - **5. Explain (Engineering Defense):** "Why did performance saturate? What physical or OS invariant protected the system?".

{ASSIGNMENT_WORKFLOW_RULES}

{CORE_INVARIANTS}

{ATTENTION_CONTRACT}""")

TOOL_FUNCTIONS = [
    assignment_generate,
    assignment_read,
    arcs_list,
    workspace_read,
    workspace_write,
    update_working_memory,
]

assigner_agent = Agent(
    get_model(),
    name="assigner",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
assigner_agent.instructions(inject_working_memory)
