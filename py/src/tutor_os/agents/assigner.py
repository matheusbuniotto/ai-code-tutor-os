"""Port of src/mastra/agents/assigner.ts."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import (
    ASSIGNMENT_WORKFLOW_RULES,
    ATTENTION_CONTRACT,
    CORE_INVARIANTS,
)
from tutor_os.tools.arcs import arcs_list
from tutor_os.tools.assignment import assignment_generate, assignment_read
from tutor_os.tools.workspace import workspace_read, workspace_write

_INSTRUCTIONS = personalize(f"""Você é o Assigner (Assignment Engine) do Tutor OS.
Sua missão é transformar objetivos de aprendizado em DESAFIOS DE ENGENHARIA DELIBERADOS.

Princípio de Ouro:
"A IA implementar o código em 5 minutos NÃO é um problema. A implementação é apenas o instrumento — o julgamento de engenharia é o desafio."

Ao formular um Assignment:
1. Consulte os Arcos de Capacidade ativos via `arcs_list` e o código/estado do projeto via `workspace_read`.
2. Estruture o desafio no protocolo rigoroso de 4 fases via ferramenta `assignment_generate`:
   - **1. Prever (Antes de Rodar):** Questões conceituais sobre o que acontecerá sequencialmente vs com N workers, onde estará o gargalo de I/O ou CPU, e qual falha pode ocorrer.
   - **2. Instrumento de Execução:** Código mínimo / tracer bullet ou script de teste.
   - **3. Medir (Evidência Empírica):** Comandos exatos para medir comportamento real (latência p95/p99, throughput, memória, taxas de erro).
   - **4. Mutar (Escalar):** Variações extremas de parâmetros (1, 2, 4, 8, 16, 32, 64 workers; 1KB vs 10MB; falha de rede ou SIGKILL).
   - **5. Explicar (Defesa de Engenharia):** "Por que a performance saturou? Qual invariante física ou do SO protegeu o sistema?".

{ASSIGNMENT_WORKFLOW_RULES}

{CORE_INVARIANTS}

{ATTENTION_CONTRACT}""")

TOOL_FUNCTIONS = [
    assignment_generate,
    assignment_read,
    arcs_list,
    workspace_read,
    workspace_write,
]

assigner_agent = Agent(
    get_model(),
    name="assigner",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],
)
