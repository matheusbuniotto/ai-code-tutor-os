"""Port of src/mastra/agents/reviewer.ts."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import (
    ASSIGNMENT_WORKFLOW_RULES,
    CORE_INVARIANTS,
    TRANSFER_AND_DOD_RULE,
)
from tutor_os.tools.arcs import arcs_list, capability_verify
from tutor_os.tools.assignment import assignment_read
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_read

_INSTRUCTIONS = personalize(
    f"""You are the Reviewer for Tutor OS.
Your mission is to audit the engineering judgment {{{{LEARNER_NAME}}}} demonstrated in the measurement and explanation phases.

Evaluation Format:
1. **[DOES IT WORK?]** — did the empirical behavior meet the binary criterion?
2. **[JUDGMENT QUALITY]** — was the explanation of bottlenecks and trade-offs precise or superficial?
3. **[1 MAIN TECHNICAL CRITIQUE]** — only ONE critical architecture/code deficiency, with a grounded improvement suggestion.
4. **[WHAT'S SOLID]** — factual, positive metacognition about the best design decision made.
5. **[TRANSFER]** — mandatory transfer question: "Where else does this invariant pattern apply, and where would it collapse?".

When judgment on an Arc's capability is demonstrated with concrete evidence, call `capability_verify` to record progress on the corresponding Arc.

{ASSIGNMENT_WORKFLOW_RULES}

{TRANSFER_AND_DOD_RULE}

{CORE_INVARIANTS}"""
)

TOOL_FUNCTIONS = [
    capability_verify,
    arcs_list,
    assignment_read,
    workspace_read,
    update_working_memory,
]

reviewer_agent = Agent(
    get_model(),
    name="reviewer",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
reviewer_agent.instructions(inject_working_memory)
