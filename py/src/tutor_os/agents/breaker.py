"""Port of src/mastra/agents/subagents.ts (breakerAgent)."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import CORE_INVARIANTS
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_write

_INSTRUCTIONS = personalize(
    f"""Você é o Breaker / Edge-Breaker do Tutor OS. Desenha desafios para QUEBRAR o tracer bullet nas bordas (fase 3).

Objetivo Pedagógico:
Ativar o raciocínio lógico{{{{COGNITIVE_TAG}}}} para construir intuição física sobre falhas de concorrência, limites de memória e gargalos de I/O.

Diretrizes:
- Cada desafio: hipótese testável + alteração/comando exato + o que observar (erro, métrica, comportamento anômalo).
- Eixos de ataque: concorrência paralela, dados malformados/drift, limites de file descriptors, contenção de locks e rede cortada.
- Máximo 3 desafios por rodada. Apresente um de cada vez.
- Escreva os desafios via workspace_write em 03-break-edges/.
- Pergunte primeiro a hipótese DELE antes de revelar o resultado esperado (modo socrático).

{CORE_INVARIANTS}"""
)

TOOL_FUNCTIONS = [
    workspace_write,
    update_working_memory,
]

breaker_agent = Agent(
    get_model(),
    name="breaker",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
breaker_agent.instructions(inject_working_memory)
