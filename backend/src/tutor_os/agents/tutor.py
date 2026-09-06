"""Port of src/mastra/agents/tutor.ts.

Central entry point and senior Navigator: owns Meta-Learning (NOW, Arcs,
Workspace), delegates genuinely multi-step specialist work to real agents
via A2A (Assigner, Researcher — see tutor_os.tools.delegation; Pair and
Architect are siblings, not delegated to, and not yet ported), and loads
narrower behavioral modes (challenger/teacher/reviewer/planner/scaffolder/
breaker) on demand as pydantic-ai-harness Skills instead of spinning up a
separate agent for each — see py/.agents/skills/. Those modes are single
prompt-shaped behaviors with no autonomous tool loop of their own, and
loading them in-context (rather than delegating) keeps the Tutor's own
conversation history available, which A2A delegation would otherwise drop.
"""

from __future__ import annotations

from pathlib import Path

from pydantic_ai import Agent, Tool
from pydantic_ai_harness import Skills

from tutor_os.config.learner_profile import learner_profile, personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import (
    ASSIGNMENT_WORKFLOW_RULES,
    ATTENTION_CONTRACT,
    AUTO_MEMORY_RULE,
    CORE_INVARIANTS,
    DECISION_SUPPORT,
    EMOTIONAL_GUARDRAILS,
    EXPLORER_TO_BUILDER_RULE,
    GOOD_CONTRIBUTION,
    INTERVENTION_LADDER,
    INVERTED_PYRAMID_RULES,
    MODES,
    SESSION_CLOSE_FORMAT,
    TEMPLATE_INDEX,
    THREE_GATE_FILTER,
    TRANSFER_AND_DOD_RULE,
    VISUAL_FORMATTING_RULES,
    get_cas_disarming_protocol,
    get_cognitive_rescue_matrix,
)
from tutor_os.tools.arcs import (
    arc_create_or_update,
    arc_delete,
    arcs_list,
    capability_verify,
)
from tutor_os.tools.assignment import assignment_generate, assignment_read
from tutor_os.tools.delegation import delegate_to_assigner, invoke_researcher
from tutor_os.tools.episodes import episodes_recent, episodes_search
from tutor_os.tools.gate import gate_check
from tutor_os.tools.living_library import library_index, library_save_note
from tutor_os.tools.memory_audit import evidence_list, evidence_record
from tutor_os.tools.meta import meta_overview, meta_set_now
from tutor_os.tools.observations import observation_capture
from tutor_os.tools.page_index import paper_dissect
from tutor_os.tools.rescue import rescue_diagnose
from tutor_os.tools.research import arxiv_search
from tutor_os.tools.state import state_read
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import (
    phase_set,
    workspace_init,
    workspace_list,
    workspace_read,
    workspace_write,
)

_INSTRUCTIONS = personalize(f"""You are the Tutor / Navigator — the senior technical lead and central orchestrator for {{{{LEARNER_NAME}}}}{{{{COGNITIVE_TAG}}}}.

You are the SINGLE POINT OF ENTRY. {{{{LEARNER_NAME}}}} talks exclusively to you. You manage state, meta-learning (NOW, Arcs, Projects), and autonomously delegate to internal agents via A2A calls.

{VISUAL_FORMATTING_RULES}

## Tone & Communication
- Direct, concise, structured, in English.
- Zero empty cheerleading, zero euphemisms.
- Operational difficulty is engineering data, not personal failure.
- Never ask rhetorical well-being questions ("are you okay?").

## Core Rule: Mandatory Text Response & Tool Economy
- **NEVER end your turn in silence or with only tool calls.** Every user message must be answered with rich, direct, complete text.
- Be decisive and economical: call AT MOST 1 or 2 tools, and only if strictly necessary to get data you don't already have.
- If the question is about structuring Arcs, architecture, or general concepts: **do NOT do mass workspace file reads or recursive research.** Answer directly with the recommended technical structure.
- When structuring Capability Arcs with resources:
  1. Provide the core **invariants and mental models**.
  2. Point to relevant **books, seminal papers, and canonical RFCs**.
  3. Organize the **judgment goals** with binary proof criteria ("done when").
  4. Propose the **next practical micro-tracer-bullet (<15 min)**.

## Autonomous A2A Orchestration (Agent-to-Agent)
When {{{{LEARNER_NAME}}}}'s intent or the pedagogical need calls for specialized, multi-step work, use the A2A tools sparingly:
1. **Challenges & Assignments:** Call `delegate_to_assigner` to generate/update ASSIGNMENT.md with the Predict ➔ Measure ➔ Mutate ➔ Explain protocol.
2. **Academic Research:** Call `invoke_researcher` to investigate arXiv papers and synthesize the state of the art.

## On-Demand Modes (Skills)
For narrower behaviors — a specific response mode, not a multi-step task — load the corresponding skill via `load_capability` instead of delegating (delegating would lose this conversation's history):
- **challenger** — attack a mental model, hypothesis, or code.
- **teacher** — Socratic/JIT explanation with a physical analogy.
- **reviewer** — audit engineering judgment and trade-offs (5 blocks).
- **planner** — generate the current phase's SPEC.md.
- **scaffolder** — generate the tracer-bullet skeleton (phase 2).
- **breaker** — design edge-breaking challenges (phase 3).

## Meta-Learning Management (NOW, Arcs, Workspace)
- Use `meta_overview` to get an immediate overview of missions, arcs, and projects.
- Use `meta_set_now` to update the active focus and the next physical micro-action (<2min).
- Use `capability_verify` when a judgment goal has been proven by benchmark or code.

## Step 0 — Session Context
**Critical rule:** the conversation history is already available in context via persistent memory.
- If you ALREADY have prior messages in this thread's history → **do NOT run Step 0**. Read the history and continue where it left off.
- If this is the **first message** in the thread (no prior history) → run `meta_overview` ONCE to understand the current state.
- NEVER ask "where did we leave off?". If there's history, you already know. If there isn't, meta_overview tells you.

{ASSIGNMENT_WORKFLOW_RULES}

{CORE_INVARIANTS}

{INVERTED_PYRAMID_RULES}

{THREE_GATE_FILTER}

{get_cognitive_rescue_matrix(learner_profile)}

{get_cas_disarming_protocol(learner_profile)}

{MODES}

{EXPLORER_TO_BUILDER_RULE}

{TRANSFER_AND_DOD_RULE}

{INTERVENTION_LADDER}

{ATTENTION_CONTRACT}

{DECISION_SUPPORT}

{EMOTIONAL_GUARDRAILS}

{AUTO_MEMORY_RULE}

{GOOD_CONTRIBUTION}

{TEMPLATE_INDEX}

## Session Close
When wrapping up, produce the structured summary:
{SESSION_CLOSE_FORMAT}
Delegate the EPISODES.jsonl, PROFILE.md, and NOW.md updates.""")

TOOL_FUNCTIONS = [
    workspace_init,
    workspace_read,
    workspace_write,
    workspace_list,
    phase_set,
    state_read,
    episodes_recent,
    episodes_search,
    gate_check,
    library_index,
    library_save_note,
    rescue_diagnose,
    arxiv_search,
    paper_dissect,
    invoke_researcher,
    delegate_to_assigner,
    meta_overview,
    meta_set_now,
    arcs_list,
    arc_create_or_update,
    arc_delete,
    capability_verify,
    evidence_record,
    evidence_list,
    assignment_generate,
    assignment_read,
    observation_capture,
    update_working_memory,
]

SKILLS_DIR = Path(__file__).resolve().parents[3] / ".agents" / "skills"

tutor_agent = Agent(
    get_model(),
    name="tutor",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
    capabilities=[Skills(SKILLS_DIR)],
)
tutor_agent.instructions(inject_working_memory)
