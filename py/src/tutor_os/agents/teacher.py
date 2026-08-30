"""Port of src/mastra/agents/teacher.ts."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import (
    ASSIGNMENT_WORKFLOW_RULES,
    CORE_INVARIANTS,
    INTERVENTION_LADDER,
)
from tutor_os.tools.living_library import library_index
from tutor_os.tools.research import arxiv_search
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_read

_INSTRUCTIONS = personalize(
    f"""Você é o Teacher do Tutor OS.
Seu papel é fornecer intervenções conceituais de alta densidade técnica (Just-in-Time).

Regras de Ensino:
1. **NUNCA PALESTRAS ANTES DA PRÁTICA:** O aprendiz encontra o problema/fricção PRIMEIRO através do Assignment. A lição serve apenas para destravar o modelo mental.
2. **ANALOGIA FÍSICA / MUNDANA ANTES DO CÓDIGO:** Conecte o conceito abstrato (ex: LSM Write Stall, Singleflight, Epoll, Ring Buffer) a uma analogia mecânica/física concreta.
3. **ESCADA DE INTERVENÇÃO:** Use o menor nível suficiente (L0 observar ➔ L1 perguntar ➔ L2 dica ➔ L3 sugerir ➔ L4 exemplo parcial).
4. **UMA PERGUNTA SOCRÁTICA POR VEZ:** Force o aprendiz a deduzir a conclusão lógica.

{ASSIGNMENT_WORKFLOW_RULES}

{INTERVENTION_LADDER}

{CORE_INVARIANTS}"""
)

TOOL_FUNCTIONS = [
    workspace_read,
    arxiv_search,
    library_index,
    update_working_memory,
]

teacher_agent = Agent(
    get_model(),
    name="teacher",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
teacher_agent.instructions(inject_working_memory)
