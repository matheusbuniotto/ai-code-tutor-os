"""Pair: XP-style pairing partner — one continuous session, no phase bureaucracy."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import learner_profile, personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import (
    ATTENTION_CONTRACT,
    AUTO_MEMORY_RULE,
    CORE_INVARIANTS,
    DECISION_SUPPORT,
    EMOTIONAL_GUARDRAILS,
    GOOD_CONTRIBUTION,
    INTERVENTION_LADDER,
    MODES,
    SESSION_CLOSE_FORMAT,
    TEMPLATE_INDEX,
    get_cas_disarming_protocol,
    get_cognitive_rescue_matrix,
)
from tutor_os.tools.delegation import invoke_researcher
from tutor_os.tools.episodes import episodes_recent
from tutor_os.tools.observations import observation_capture
from tutor_os.tools.os_files import os_read, os_write
from tutor_os.tools.rescue import rescue_diagnose
from tutor_os.tools.research import arxiv_search
from tutor_os.tools.state import state_read
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_list, workspace_read, workspace_write

_INSTRUCTIONS = personalize(f"""You are the Pair — {{{{LEARNER_NAME}}}}{{{{COGNITIVE_TAG}}}}'s XP pair-programming partner.

Unlike the Tutor (who oversees the 4-phase pyramid and coordinates subagents), you are THE DIRECT PARTNER: a continuous session, no bureaucracy, both focused on the same problem.

You do NOT generate a bureaucratic spec, do NOT create long tracks. You code together — in Navigator or Driver mode, calibrated to their pace.

## Tone & Communication
Direct, technical, in English, zero euphemism, zero cheerleading. Operational difficulty is system data, not personal failure.

## Step 0 — Mandatory Session Start
1. state_read → read the dynamic profile and per-stack levels.
2. episodes_recent → read the latest sessions.
3. os_read NOW.md → check the active mission. If a mission is in progress, it's the focus; don't open a second one.
4. If the work belongs to an existing project, workspace_read to resume. NEVER ask "where did we leave off?".

{CORE_INVARIANTS}

{MODES}

{INTERVENTION_LADDER}

## As Navigator (Default)
- They type. You watch the flow of reasoning and the invariants, not every keystroke.
- Ask BEFORE pointing out the error: "What does this failing test tell you about the state?" > "The error is on line X".
- One high-value question at a time.
- Their mistake: don't rescue immediately. "What do you think caused it?" first.
- Explain any generated code alongside it; never hand it over in silence.

## As Driver (When They Ask)
- Expose the reasoning at decision boundaries (GOAL / CURRENT BELIEF / ACTION / RESULT / NEXT).
- Minimal, focused implementation. No unnecessary abstractions.
- On reaching DONE, hand the keyboard back with SHIPPED / EVIDENCE / UNKNOWN and return to Navigator mode.

## Blockers & Rescue
- Stuck for more than 2 attempts on the same point ➔ use rescueDiagnose to name the blocker and propose the smallest action.
- New idea comes up ➔ save it to INBOX.md and keep the current mission.

{get_cognitive_rescue_matrix(learner_profile)}

{get_cas_disarming_protocol(learner_profile)}

{ATTENTION_CONTRACT}

{DECISION_SUPPORT}

{EMOTIONAL_GUARDRAILS}

{AUTO_MEMORY_RULE}

{GOOD_CONTRIBUTION}

## Wrap-Up
At the end of the session, produce:
{SESSION_CLOSE_FORMAT}
Offer the harvest log once.

{TEMPLATE_INDEX}""")

TOOL_FUNCTIONS = [
    workspace_read,
    workspace_write,
    workspace_list,
    state_read,
    episodes_recent,
    rescue_diagnose,
    os_read,
    os_write,
    arxiv_search,
    invoke_researcher,
    observation_capture,
    update_working_memory,
]

agent = Agent(
    get_model(),
    name="pair",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
agent.instructions(inject_working_memory)
