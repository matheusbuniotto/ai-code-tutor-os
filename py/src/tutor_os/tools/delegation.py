"""Port of src/mastra/tools/delegation.ts (partial, by design).

Protocolo A2A (Agent-to-Agent): permite que o Tutor (Navigator Unificado)
delegue trabalho genuinamente multi-etapa a agentes internos independentes.

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
    """Protocolo A2A: Delega ao Assigner Agent a criação de um desafio de engenharia estruturado (Predict ➔ Measure ➔ Mutate ➔ Explain) focado em uma meta de capacidade ou lacuna de julgamento.

    Args:
        project_slug: Slug do projeto ativo (ex: sysdesign-m04-storage).
        capability_or_goal: A meta de capacidade ou conceito a ser exercitado.
        context: Contexto ou implementação atual do código.
    """
    prompt = f"""[ASSIGNMENT REQUEST]
Projeto: {project_slug}
Meta de Capacidade / Julgamento: {capability_or_goal}
{f"Contexto Técnico: {context}" + chr(10) if context else ""}
Gere o desafio de engenharia estruturado no protocolo Predict ➔ Measure ➔ Mutate ➔ Explain e salve no ASSIGNMENT.md do projeto."""

    result = await assigner_agent.run(prompt)
    return {"assignment": result.output or ""}


async def invoke_researcher(question: str, context: str | None = None) -> dict:
    """Protocolo A2A: Delega uma dúvida técnica ou busca de literatura científica para o Researcher Agent (arXiv).

    Args:
        question: A pergunta ou incerteza técnica específica a ser pesquisada.
        context: Contexto arquitetural ou restrições do sistema.
    """
    prompt = (
        f"Contexto: {context}\n\nIncerteza técnica para pesquisa delimitada:\n{question}"
        if context
        else question
    )

    result = await researcher_agent.run(prompt)
    return {"report": result.output or ""}
