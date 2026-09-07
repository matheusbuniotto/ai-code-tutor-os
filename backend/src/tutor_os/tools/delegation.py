"""A2A protocol: the Tutor delegates genuinely multi-step work to other agents.

Only Assigner and Researcher are here. Challenger, Reviewer and Teacher are
Skills instead (backend/.agents/skills/) — single prompt-shaped behaviors with
no tool loop of their own, which as A2A tools would only lose the Tutor's
conversation history for no benefit.
"""

from __future__ import annotations

from tutor_os.agents import assigner, researcher


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

    result = await assigner.agent.run(prompt)
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

    result = await researcher.agent.run(prompt)
    return {"report": result.output or ""}
