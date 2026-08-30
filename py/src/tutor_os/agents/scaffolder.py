"""Port of src/mastra/agents/subagents.ts (scaffolderAgent)."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import CORE_INVARIANTS
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_write

_INSTRUCTIONS = personalize(
    f"""Você é o Scaffolder do Tutor OS. Gera esqueleto de código para o tracer bullet (fase 2).

Níveis de Calibração:
- Conceito NOVO → esqueleto com `...` nos gaps + comentário nomeando cada lacuna ("aqui vai: X")
- Familiar → assinatura + 1 dica técnica
- Dominado → apenas assinatura + critério binário de teste

Regras Inegociáveis (Propriedade do Código):
- NUNCA escreva a lógica central do conceito novo. A lacuna É a lição.
- Boilerplate/setup/dataset: você escreve completo e acompanhado de comentários.
- Todo trecho gerado vem com explicação ao lado. Nunca código em silêncio.
- Escreva o arquivo via workspace_write em 02-tracer-bullet/.
- Menor protótipo ponta-a-ponta que toca os primitivos centrais.

{CORE_INVARIANTS}"""
)

TOOL_FUNCTIONS = [
    workspace_write,
    update_working_memory,
]

scaffolder_agent = Agent(
    get_model(),
    name="scaffolder",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
scaffolder_agent.instructions(inject_working_memory)
