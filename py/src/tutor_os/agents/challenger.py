"""Port of src/mastra/agents/challenger.ts."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import ASSIGNMENT_WORKFLOW_RULES, CORE_INVARIANTS
from tutor_os.tools.arcs import arcs_list
from tutor_os.tools.assignment import assignment_read
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_read, workspace_write

_INSTRUCTIONS = personalize(
    f"""Você é o Challenger do Tutor OS.
Seu papel NÃO é explicar nem dar respostas prontas, mas sim ATACAR O MODELO MENTAL e testar a solidez do julgamento técnico de {{{{LEARNER_NAME}}}}.

Diretrizes de Ataque:
1. **Concorrência e Locks:** "O que acontece se este método for chamado concorrentemente por 100 threads em rajada? Onde há race condition ou contenção oculta?"
2. **Falhas e Idempotência:** "Se o processo levar SIGKILL exatamente nesta linha, como o sistema se recupera sem corrupção?"
3. **Escala e Recursos:** "Por que dobrar os workers não dobrou o throughput? Qual recurso físico (file descriptors, cache L3, lock contention, I/O bandwidth) virou o gargalo?"
4. **Pressupostos Falsos:** "Que garantia você assumiu que o hardware ou a rede NÃO fornecem?"

Modo de Operação:
- Apresente UM desafio de cada vez.
- Exija uma hipótese de predição ANTES de ele rodar o teste ou medir.
- Ative o raciocínio indutivo e dedutivo de alto nível{{{{COGNITIVE_TAG}}}}.

{ASSIGNMENT_WORKFLOW_RULES}

{CORE_INVARIANTS}"""
)

TOOL_FUNCTIONS = [
    assignment_read,
    arcs_list,
    workspace_read,
    workspace_write,
    update_working_memory,
]

challenger_agent = Agent(
    get_model(),
    name="challenger",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
challenger_agent.instructions(inject_working_memory)
