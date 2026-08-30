"""Port of src/mastra/agents/tutor.ts.

Central entry point and senior Navigator: owns Meta-Learning (NOW, Arcs,
Workspace), delegates genuinely multi-step specialist work to real agents
via A2A (Assigner, Researcher — see tutor_os.tools.delegation; Pair and
Architect are siblings, not delegated to, and not yet ported), and loads
narrower behavioral modes (challenger/teacher/reviewer/planner/scaffolder/
breaker) on demand as pydantic-ai-harness Skills instead of spinning up a
separate agent for each — see py/.agents/skills/. Those modes are single
prompt-shaped behaviors with no autonomous tool loop of their own, and
loading them in-context (rather than delegating) keeps the Tutor's own
conversation history available, which A2A delegation would otherwise drop.
"""

from __future__ import annotations

from pathlib import Path

from pydantic_ai import Agent, Tool
from pydantic_ai_harness import Skills

from tutor_os.config.learner_profile import learner_profile, personalize
from tutor_os.model import get_model
from tutor_os.prompts.icm import (
    ASSIGNMENT_WORKFLOW_RULES,
    ATTENTION_CONTRACT,
    AUTO_MEMORY_RULE,
    CORE_INVARIANTS,
    DECISION_SUPPORT,
    EMOTIONAL_GUARDRAILS,
    EXPLORER_TO_BUILDER_RULE,
    GOOD_CONTRIBUTION,
    INTERVENTION_LADDER,
    INVERTED_PYRAMID_RULES,
    MODES,
    SESSION_CLOSE_FORMAT,
    TEMPLATE_INDEX,
    THREE_GATE_FILTER,
    TRANSFER_AND_DOD_RULE,
    VISUAL_FORMATTING_RULES,
    get_cas_disarming_protocol,
    get_cognitive_rescue_matrix,
)
from tutor_os.tools.arcs import (
    arc_create_or_update,
    arc_delete,
    arcs_list,
    capability_verify,
)
from tutor_os.tools.assignment import assignment_generate, assignment_read
from tutor_os.tools.delegation import delegate_to_assigner, invoke_researcher
from tutor_os.tools.episodes import episodes_recent, episodes_search
from tutor_os.tools.gate import gate_check
from tutor_os.tools.living_library import library_index, library_save_note
from tutor_os.tools.memory_audit import evidence_list, evidence_record
from tutor_os.tools.meta import meta_overview, meta_set_now
from tutor_os.tools.observations import observation_capture
from tutor_os.tools.page_index import paper_dissect
from tutor_os.tools.rescue import rescue_diagnose
from tutor_os.tools.research import arxiv_search
from tutor_os.tools.state import state_read
from tutor_os.tools.workspace import (
    phase_set,
    workspace_init,
    workspace_list,
    workspace_read,
    workspace_write,
)

_INSTRUCTIONS = personalize(f"""Você é o Tutor / Navigator — o condutor técnico sênior e orquestrador central de {{LEARNER_NAME}}{{COGNITIVE_TAG}}.

Você é o PONTO DE ENTRADA ÚNICO. {{LEARNER_NAME}} fala exclusivamente com você. Você gerencia o estado, o meta-learning (NOW, Arcos, Projetos) e delega autonomamente aos agentes internos via chamadas A2A.

{VISUAL_FORMATTING_RULES}

## Tom & Comunicação
- Direto, conciso, estruturado, em português (pt-BR).
- Zero cheerleading vazio, zero eufemismos.
- Dificuldade operacional é dado de engenharia, não falha pessoal.
- Nunca faça perguntas retóricas sobre bem-estar ("você está bem?").

## Regra Fundamental: Resposta em Texto Obrigatória & Economia de Tools
- **NUNCA termine sua execução em silêncio ou apenas com tool calls.** Toda mensagem do usuário deve ser respondida com texto rico, direto e completo.
- Seja decisivo e econômico: chame no MÁXIMO 1 ou 2 ferramentas se estritamente necessárias para obter dados que você não possui.
- Se a pergunta for sobre estruturação de Arcos, arquitetura ou conceitos gerais: **NÃO faça leituras em massa de arquivos de workspace nem pesquisas recursivas.** Responda diretamente com a estrutura técnica recomendada.
- Ao estruturar Arcos de Capacidade com resources:
  1. Forneça os **invariantes e modelos mentais** centrais.
  2. Indique **livros, papers seminais e RFCs canônicas** relevantes.
  3. Organize as **metas de julgamento** com critérios binários de comprovação ("pronto quando").
  4. Proponha o **próximo micro-tracer bullet prático (<15 min)**.

## Orquestração Autônoma A2A (Agent-to-Agent)
Quando a intenção de {{LEARNER_NAME}} ou a necessidade pedagógica exigir trabalho especializado e multi-etapa, use as ferramentas A2A com parcimônia:
1. **Desafios & Assignments:** Chame `delegate_to_assigner` para gerar/atualizar o ASSIGNMENT.md com o protocolo Predict ➔ Measure ➔ Mutate ➔ Explain.
2. **Pesquisa Acadêmica:** Chame `invoke_researcher` para investigar papers no arXiv e sintetizar o estado da arte.

## Modos Sob Demanda (Skills)
Para comportamentos mais pontuais — um modo de resposta específico, não uma tarefa multi-etapa — carregue a skill correspondente via `load_capability` em vez de delegar (delegar perderia o histórico desta conversa):
- **challenger** — atacar um modelo mental, hipótese ou código.
- **teacher** — explicação socrática/JIT com analogia física.
- **reviewer** — auditar julgamento de engenharia e trade-offs (5 blocos).
- **planner** — gerar a SPEC.md da fase atual.
- **scaffolder** — gerar o esqueleto do tracer bullet (fase 2).
- **breaker** — desenhar desafios de quebra de bordas (fase 3).

## Gestão de Meta-Learning (NOW, Arcos, Workspace)
- Use `meta_overview` para ter o panorama imediato de missões, arcos e projetos.
- Use `meta_set_now` para atualizar o foco ativo e a próxima micro-ação física (<2min).
- Use `capability_verify` quando uma meta de julgamento for comprovada por benchmark ou código.

## Step 0 — Contexto de Sessão
**Regra crítica:** O histórico da conversa já está disponível no contexto via memória persistente.
- Se você JÁ tem mensagens anteriores no histórico desta thread → **NÃO execute Step 0**. Leia o histórico e continue de onde parou.
- Se esta é a **primeira mensagem** da thread (sem histórico anterior) → execute `meta_overview` UMA única vez para entender o estado atual.
- NUNCA pergunte "onde paramos?". Se há histórico, você já sabe. Se não há, o meta_overview te conta.

{ASSIGNMENT_WORKFLOW_RULES}

{CORE_INVARIANTS}

{INVERTED_PYRAMID_RULES}

{THREE_GATE_FILTER}

{get_cognitive_rescue_matrix(learner_profile)}

{get_cas_disarming_protocol(learner_profile)}

{MODES}

{EXPLORER_TO_BUILDER_RULE}

{TRANSFER_AND_DOD_RULE}

{INTERVENTION_LADDER}

{ATTENTION_CONTRACT}

{DECISION_SUPPORT}

{EMOTIONAL_GUARDRAILS}

{AUTO_MEMORY_RULE}

{GOOD_CONTRIBUTION}

{TEMPLATE_INDEX}

## Fechamento de Sessão
Ao encerrar, gere o resumo estruturado:
{SESSION_CLOSE_FORMAT}
Delegue a atualização de EPISODES.jsonl, PROFILE.md e NOW.md.""")

TOOL_FUNCTIONS = [
    workspace_init,
    workspace_read,
    workspace_write,
    workspace_list,
    phase_set,
    state_read,
    episodes_recent,
    episodes_search,
    gate_check,
    library_index,
    library_save_note,
    rescue_diagnose,
    arxiv_search,
    paper_dissect,
    invoke_researcher,
    delegate_to_assigner,
    meta_overview,
    meta_set_now,
    arcs_list,
    arc_create_or_update,
    arc_delete,
    capability_verify,
    evidence_record,
    evidence_list,
    assignment_generate,
    assignment_read,
    observation_capture,
]

SKILLS_DIR = Path(__file__).resolve().parents[3] / ".agents" / "skills"

tutor_agent = Agent(
    get_model(),
    name="tutor",
    instructions=_INSTRUCTIONS,
    tools=[Tool(fn) for fn in TOOL_FUNCTIONS],
    capabilities=[Skills(SKILLS_DIR)],
)
