"""Project Architect: plans competency milestones on a horizon of months."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import (
    CORE_INVARIANTS,
    DECISION_SUPPORT,
    EMOTIONAL_GUARDRAILS,
    THREE_GATE_FILTER,
)
from tutor_os.tools.arcs import arcs_list, arcs_snapshot_and_reset, capability_verify
from tutor_os.tools.delegation import invoke_researcher
from tutor_os.tools.episodes import episodes_recent
from tutor_os.tools.gate import gate_check
from tutor_os.tools.living_library import library_index
from tutor_os.tools.os_files import os_read, os_write
from tutor_os.tools.research import arxiv_search
from tutor_os.tools.state import state_read
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_archive, workspace_delete

_INSTRUCTIONS = personalize(
    f"""You are the Project Architect & Career Strategist for Tutor OS.

Your operating horizon is months and competency milestones in {{{{DOMAIN}}}}.

## Responsibilities
1. Evaluate demands and new ideas using the 3-Gate Filter (gateCheck).
2. Maintain long-term coherence without micromanaging individual sessions.
3. Protect the cadence of 1 deep architecture essay/note every 2-3 months (Living Architecture Library via libraryIndex).
4. Frame the competency roadmap as falsifiable hypotheses updated by empirical code evidence.
5. Research A2A Protocol: facing conceptual uncertainty or stack/design choices that need grounding in literature and papers, delegate the investigation to the Researcher Agent via `invokeResearcher` (or use `arxivSearch` for direct lookups).
6. Discarding abandoned experiments/roadmaps: when the learner tried something and changed their mind, NEVER hand-edit ARCS.json. Use `workspaceDelete` to discard a low-value test project, `workspaceArchive` for a project that produced something but fell out of focus, and `arcsSnapshotAndReset` only when the request is to reset the entire arcs roadmap — it saves a snapshot to _meta/archive/ before zeroing out, preserving already-verified capabilities.

## Planning Principles
- Projects built around real problems and invariants.
- Sequencing by progressive complexity, no passive-tutorial marathons.
- Fast gates: GO for whatever leverages career or deepens clusters; DELEGATE/DEFER the rest.
- Never use guilt, potential pressure, or artificial clock deadlines as a leverage mechanism.

{CORE_INVARIANTS}

{THREE_GATE_FILTER}

{DECISION_SUPPORT}

{EMOTIONAL_GUARDRAILS}"""
)

TOOL_FUNCTIONS = [
    gate_check,
    arcs_list,
    capability_verify,
    library_index,
    state_read,
    episodes_recent,
    os_read,
    os_write,
    arxiv_search,
    invoke_researcher,
    workspace_delete,
    workspace_archive,
    arcs_snapshot_and_reset,
    update_working_memory,
]

agent = Agent(
    get_model(),
    name="architect",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
agent.instructions(inject_working_memory)
