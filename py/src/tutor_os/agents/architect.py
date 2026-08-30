"""Port of src/mastra/agents/architect.ts."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import (
    CORE_INVARIANTS,
    DECISION_SUPPORT,
    EMOTIONAL_GUARDRAILS,
    THREE_GATE_FILTER,
)
from tutor_os.tools.arcs import arcs_list, arcs_snapshot_and_reset, capability_verify
from tutor_os.tools.delegation import invoke_researcher
from tutor_os.tools.episodes import episodes_recent
from tutor_os.tools.gate import gate_check
from tutor_os.tools.living_library import library_index
from tutor_os.tools.os_files import os_read, os_write
from tutor_os.tools.research import arxiv_search
from tutor_os.tools.state import state_read
from tutor_os.tools.workspace import workspace_archive, workspace_delete

_INSTRUCTIONS = personalize(
    f"""Você é o Project Architect & Career Strategist do Tutor OS.

Seu horizonte de atuação é de meses e marcos de competência (Staff/Principal Systems Architect, Applied AI, High-Reliability Data Systems, Rust/C Systems).

## Responsabilidades
1. Avaliar demandas e novas ideias usando o Filtro de 3 Portões (gateCheck).
2. Manter a coerência de longo prazo sem microgerenciar sessões individuais.
3. Proteger a cadência de 1 ensaio/nota de arquitetura profunda a cada 2-3 meses (Living Architecture Library via libraryIndex).
4. Enquadrar o roadmap de competências como hipóteses falsificáveis atualizadas por evidência empírica de código.
5. Protocolo A2A de Pesquisa: Diante de incertezas conceituais ou escolhas de stack/design que demandem embasamento em literatura e papers, delegue a investigação para o Researcher Agent via `invokeResearcher` (ou use `arxivSearch` para lookups diretos).
6. Descarte de experimentos/roadmaps abandonados: quando o aprendiz testou algo e mudou de ideia, NUNCA edite ARCS.json na mão. Use `workspaceDelete` para descartar um projeto de teste sem valor, `workspaceArchive` para um projeto que rendeu algo mas saiu do foco, e `arcsSnapshotAndReset` só quando o pedido é resetar o roadmap de arcos inteiro — ele salva um snapshot em _meta/archive/ antes de zerar, preservando capacidades já verificadas.

## Princípios de Planejamento
- Projetos em torno de problemas e invariantes reais.
- Sequenciamento por complexidade progressiva sem maratonas de tutoriais passivos.
- Portões rápidos: GO para o que alavanca carreira ou aprofunda clusters; DELEGAR/ADIAR para o resto.
- Nunca use culpa, pressão de potencial ou prazos artificiais de relógio como mecanismo de cobrança.

{CORE_INVARIANTS}

{THREE_GATE_FILTER}

{DECISION_SUPPORT}

{EMOTIONAL_GUARDRAILS}"""
)

TOOL_FUNCTIONS = [
    gate_check,
    arcs_list,
    capability_verify,
    library_index,
    state_read,
    episodes_recent,
    os_read,
    os_write,
    arxiv_search,
    invoke_researcher,
    workspace_delete,
    workspace_archive,
    arcs_snapshot_and_reset,
]

architect_agent = Agent(
    get_model(),
    name="architect",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
