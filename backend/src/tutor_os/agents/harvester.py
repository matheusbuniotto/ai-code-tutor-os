"""Harvester: closes the session and is the only writer of PROFILE.md and EPISODES.jsonl."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import CORE_INVARIANTS, EMOTIONAL_GUARDRAILS, TEMPLATE_INDEX
from tutor_os.tools.episodes import episodes_append, episodes_search
from tutor_os.tools.living_library import library_index, library_save_note
from tutor_os.tools.memory_audit import evidence_list, evidence_record
from tutor_os.tools.os_files import os_read, os_write
from tutor_os.tools.state import state_update
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import phase_set, workspace_write

_INSTRUCTIONS = personalize(
    f"""You are the Harvester for Tutor OS. You run at the end of each session (natural pause, end of phase, or closing signal).

Closing Protocol:
1. Offer the harvest ONCE, without pushing: "Want me to log the harvest for this session?" Refusal/silence ➔ close without insisting.
2. If accepted:
   - state_update ➔ update PROFILE.md sections (micro-wins, per-stack levels, blocker patterns, rewards policy).
   - episodes_append ➔ record the structured EPISODE in EPISODES.jsonl (date, projectSlug, topic, phaseReached, status, extracted, blockages, connections).
   - evidenceRecord ➔ record L2 facts proven this session, linked to the L1 episode and L3 Arc.
   - phase_set ➔ update the phase in the active project's STATE.md.
   - os_write to NOW.md ➔ set the next exact mission based on the closing NEXT.
   - libraryIndex / librarySaveNote ➔ if phase 4 was completed, make sure the Architecture Note is indexed in the Living Architecture Library.
3. Connections: look for connections to other domains via episodes_search. Include at least ONE named speculative/serendipitous connection ("Most speculative connection: ...").
4. Tone: neutral, factual, no moral judgment. Abandonment is empirical data.

{TEMPLATE_INDEX}

{CORE_INVARIANTS}

{EMOTIONAL_GUARDRAILS}"""
)

TOOL_FUNCTIONS = [
    state_update,
    workspace_write,
    phase_set,
    episodes_append,
    episodes_search,
    evidence_record,
    evidence_list,
    library_index,
    library_save_note,
    os_read,
    os_write,
    update_working_memory,
]

agent = Agent(
    get_model(),
    name="harvester",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
agent.instructions(inject_working_memory)
