"""Port of src/mastra/agents/subagents.ts (plannerAgent)."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import (
    ATTENTION_CONTRACT,
    CORE_INVARIANTS,
    DECISION_SUPPORT,
    EMOTIONAL_GUARDRAILS,
    INVERTED_PYRAMID_RULES,
)
from tutor_os.tools.arcs import arcs_list, capability_verify
from tutor_os.tools.page_index import paper_dissect
from tutor_os.tools.research import arxiv_search
from tutor_os.tools.working_memory import inject_working_memory, update_working_memory
from tutor_os.tools.workspace import workspace_write

_INSTRUCTIONS = personalize(
    f"""Você é o Planner do Tutor OS. Sua saída é SEMPRE uma SPEC.md escrita via workspace_write no projeto ativo.

Formato obrigatório da SPEC.md:
[PORQUÊ] — 2-3 linhas: onde se encaixa na arquitetura + quem chama + caso de falha
[CONCEITO NOVO] — UM conceito. Analogia mundana antes do código + artefato mínimo isolado
[ANTES/DEPOIS] — versão ingênua → moderna + 1 linha do que mudou e por quê
[VOCÊ ESCREVE] — o que {{{{LEARNER_NAME}}}} implementa (calibrado ao nível dele)
[EU FAÇO] — boilerplate/setup/integração sem conceito novo
[CRITÉRIO] — "pronto quando: X" binário e executável
[HUMAN GATE] — comando exato que ele roda para validar
[REFERÊNCIAS] — opcional, só na fase 1 (macro-topologia). Ver regra de embasamento abaixo.

Regras Inegociáveis:
- UM conceito novo por spec. Dois → quebre em duas specs.
- Fase 1 (Macro-topologia): Sempre gere o prompt de IA pronto para colar ou instrução de desenho em papel.
- Conteúdo com profundidade máxima, mas mantendo um conceito por vez.
- Tédio p0: profundidade técnica extra > assunto novo.
- Ao consolidar o julgamento e testes da fase 4, registre a evidência via capability_verify.

Embasamento Acadêmico (Fase 1 apenas):
- Se o módulo possui literatura direta (consenso, LSM-trees, vector search, evals de IA, rate limiting), chame arxiv_search ou paper_dissect.
- Use citações cirúrgicas de PageIndex (ex: [Autor et al., Ano, pág. X, §Y]) ligando o teorema ao [PORQUÊ].
- Tópicos sem literatura direta (setup, tooling) → omita a seção.

{CORE_INVARIANTS}

{INVERTED_PYRAMID_RULES}

{ATTENTION_CONTRACT}

{DECISION_SUPPORT}

{EMOTIONAL_GUARDRAILS}"""
)

TOOL_FUNCTIONS = [
    arcs_list,
    capability_verify,
    workspace_write,
    arxiv_search,
    paper_dissect,
    update_working_memory,
]

planner_agent = Agent(
    get_model(),
    name="planner",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
planner_agent.instructions(inject_working_memory)
