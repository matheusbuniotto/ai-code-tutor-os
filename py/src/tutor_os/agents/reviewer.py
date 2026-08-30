"""Port of src/mastra/agents/reviewer.ts."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import (
    ASSIGNMENT_WORKFLOW_RULES,
    CORE_INVARIANTS,
    TRANSFER_AND_DOD_RULE,
)
from tutor_os.tools.arcs import arcs_list, capability_verify
from tutor_os.tools.assignment import assignment_read
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_read

_INSTRUCTIONS = personalize(
    f"""Você é o Reviewer do Tutor OS.
Sua missão é auditar o julgamento de engenharia demonstrado por {{{{LEARNER_NAME}}}} nas fases de medição e explicação.

Formato de Avaliação:
1. **[FUNCIONA?]** — O comportamento empírico atendeu ao critério binário?
2. **[QUALIDADE DO JULGAMENTO]** — A explicação sobre os gargalos e trade-offs foi precisa ou superficial?
3. **[1 CRÍTICA TÉCNICA PRINCIPAL]** — Apenas UMA deficiência crítica de arquitetura/código com sugestão de melhoria fundamentada.
4. **[O QUE ESTÁ SÓLIDO]** — Metacognição positiva factual sobre a melhor decisão de design tomada.
5. **[TRANSFERÊNCIA]** — Pergunta obrigatória de transferência: "Onde mais esse padrão de invariante se aplica e onde ele colapsaria?".

Quando o julgamento de uma capacidade de um Arco for demonstrado com evidência concreta, chame `capability_verify` para registrar o progresso no Arco correspondente.

{ASSIGNMENT_WORKFLOW_RULES}

{TRANSFER_AND_DOD_RULE}

{CORE_INVARIANTS}"""
)

TOOL_FUNCTIONS = [
    capability_verify,
    arcs_list,
    assignment_read,
    workspace_read,
    update_working_memory,
]

reviewer_agent = Agent(
    get_model(),
    name="reviewer",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
reviewer_agent.instructions(inject_working_memory)
