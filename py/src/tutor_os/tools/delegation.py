"""Port of src/mastra/tools/delegation.ts (partial, by design).

A2A (Agent-to-Agent) protocol: lets the Tutor (Unified Navigator) delegate
genuinely multi-step work to independent internal agents.

Challenger, Reviewer and Teacher were downgraded from full agents to
pydantic-ai-harness Skills (py/.agents/skills/) — each is a single
prompt-shaped behavior with no autonomous tool loop of its own, and as A2A
tools they only lost the Tutor's conversation history for no benefit. See
tutor_os.agents.tutor for how the Skills capability is wired in.
"""

from __future__ import annotations

from tutor_os.agents.assigner import assigner_agent
from tutor_os.agents.researcher import researcher_agent


async def delegate_to_assigner(
    project_slug: str, capability_or_goal: str, context: str | None = None
) -> dict:
    """A2A protocol: delegates to the Assigner Agent the creation of a structured engineering challenge (Predict -> Measure -> Mutate -> Explain) focused on a capability goal or judgment gap.

    Args:
        project_slug: Slug of the active project (e.g. sysdesign-m04-storage).
        capability_or_goal: The capability goal or concept to exercise.
        context: Context or current implementation of the code.
    """
    prompt = f"""[ASSIGNMENT REQUEST]
Project: {project_slug}
Capability / Judgment Goal: {capability_or_goal}
{f"Technical Context: {context}" + chr(10) if context else ""}
Generate the structured engineering challenge in the Predict -> Measure -> Mutate -> Explain protocol and save it to the project's ASSIGNMENT.md."""

    result = await assigner_agent.run(prompt)
    return {"assignment": result.output or ""}


async def invoke_researcher(question: str, context: str | None = None) -> dict:
    """A2A protocol: delegates a technical question or scientific-literature search to the Researcher Agent (arXiv).

    Args:
        question: The specific technical question or uncertainty to research.
        context: Architectural context or system constraints.
    """
    prompt = (
        f"Context: {context}\n\nBounded technical uncertainty to research:\n{question}"
        if context
        else question
    )

    result = await researcher_agent.run(prompt)
    return {"report": result.output or ""}
