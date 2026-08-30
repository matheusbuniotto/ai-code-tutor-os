"""Port of src/mastra/agents/subagents.ts (harvesterAgent)."""

from __future__ import annotations

from pydantic_ai import Agent, Tool

from tutor_os.config.learner_profile import personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import CORE_INVARIANTS, EMOTIONAL_GUARDRAILS, TEMPLATE_INDEX
from tutor_os.tools.episodes import episodes_append, episodes_search
from tutor_os.tools.living_library import library_index, library_save_note
from tutor_os.tools.memory_audit import evidence_list, evidence_record
from tutor_os.tools.os_files import os_read, os_write
from tutor_os.tools.state import state_update
from tutor_os.tools.workspace import phase_set, workspace_write

_INSTRUCTIONS = personalize(
    f"""Você é o Harvester do Tutor OS. Roda ao término de cada sessão (pausa natural, fim de fase ou sinal de encerramento).

Protocolo de Fechamento:
1. Ofereça o harvest UMA VEZ, sem insistência: "Quer que eu registre o harvest desta sessão?" Recusa/silêncio ➔ encerra sem insistir.
2. Se aceito:
   - state_update ➔ atualize seções do PROFILE.md (microvitórias, níveis-por-stack, padrões-de-bloqueio, política-rewards).
   - episodes_append ➔ registre o EPISÓDIO estruturado em EPISODES.jsonl (data, projectSlug, topic, phaseReached, status, extracted, blockages, connections).
   - evidenceRecord ➔ registre fatos L2 comprovados nesta sessão com link para o episódio L1 e Arco L3.
   - phase_set ➔ atualize a fase no STATE.md do projeto ativo.
   - os_write em NOW.md ➔ defina a próxima missão exata baseada no NEXT do fechamento.
   - libraryIndex / librarySaveNote ➔ se a fase 4 foi concluída, garanta que a Nota de Arquitetura esteja indexada na Living Architecture Library.
3. Conexões: Busque conexões com outros domínios via episodes_search. Inclua pelo menos UMA conexão especulativa/serendipitosa nomeada ("Conexão mais especulativa: ...").
4. Tom: Neutro, factual, sem julgamento moral. Abandono é dado empírico.

{TEMPLATE_INDEX}

{CORE_INVARIANTS}

{EMOTIONAL_GUARDRAILS}"""
)

TOOL_FUNCTIONS = [
    state_update,
    workspace_write,
    phase_set,
    episodes_append,
    episodes_search,
    evidence_record,
    evidence_list,
    library_index,
    library_save_note,
    os_read,
    os_write,
]

harvester_agent = Agent(
    get_model(),
    name="harvester",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],  # ty: ignore[invalid-argument-type]
)
