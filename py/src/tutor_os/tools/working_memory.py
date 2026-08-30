"""Port of the `workingMemory` feature of `src/mastra/memory.ts`.

Mastra's `Memory` object auto-injects a resource-scoped Markdown "Learner
Profile" document into every agent call and exposes a native
`updateWorkingMemory` tool the LLM can call to edit it turn-by-turn.
pydantic-ai has no built-in equivalent, so this reimplements the same
observable behavior: a persisted Markdown doc, injected via
`@agent.instructions` on every call (`inject_working_memory`), and an
update tool (`update_working_memory`) registered on every agent's
TOOL_FUNCTIONS.

Deviates from Mastra in one way: Mastra's native tool replaces the WHOLE
document in one shot (`{memory: string}` schema). This instead ports the
section-scoped regex-replace convention `tools/state.py` already
established for PROFILE.md, since letting the LLM resend the entire
document every turn risks silent truncation of sections it doesn't feel
like repeating.

This file's document (`WORKING_MEMORY.md`) is deliberately separate from
`tools/state.py`'s `PROFILE.md` — same as in TS, where `memory.ts`'s
workingMemory template and `state.ts`'s PROFILE.md are two independent
systems: PROFILE.md is read once at session start via an explicit
`state_read` tool call and written only by the Harvester, while
WORKING_MEMORY.md is auto-injected into every single call and editable by
any agent.
"""

from __future__ import annotations

import re
from typing import Literal

from tutor_os.config.learner_profile import LearnerProfile, learner_profile, personalize
from tutor_os.storage import WORKSPACE_ROOT

WORKING_MEMORY_PATH = WORKSPACE_ROOT / "_meta" / "WORKING_MEMORY.md"

Section = Literal[
    "perfil-cognitivo-afetivo",
    "niveis-por-stack",
    "calibracao-facil",
    "padroes-de-bloqueio",
    "politica-rewards",
    "microvitorias",
]

_SECTION_HEADERS: dict[Section, str] = {
    "perfil-cognitivo-afetivo": "Perfil Cognitivo & Afetivo",
    "niveis-por-stack": "Níveis por Stack",
    "calibracao-facil": 'Calibração "Fácil" (Boilerplate → Tutor/Driver executa)',
    "padroes-de-bloqueio": "Padrões de Bloqueio Observados",
    "politica-rewards": "Política de Rewards & Alavancagem",
    "microvitorias": "Microvitórias & Provas de Realidade Recentes",
}


def build_learner_profile_template(profile: LearnerProfile) -> str:
    """Port of `buildLearnerProfileTemplate()` in `src/mastra/memory.ts`."""
    if profile.has_neuropsych_rescue_profile:
        tag = f" ({profile.cognitive_tag})" if profile.cognitive_tag else ""
        detail = (
            profile.cognitive_profile_detail
            or "<!-- edite em Settings > Perfil do Aprendiz > Perfil Cognitivo Detalhado -->"
        )
        cognitive_section = (
            f"## Perfil Cognitivo & Afetivo{tag}\n{detail}\n"
            "<!-- Harvester complementa com observações de estilo cognitivo conforme evidência aparecer -->\n"
        )
    else:
        cognitive_section = (
            "## Perfil Cognitivo & Afetivo\n"
            "<!-- Harvester registra observações de estilo cognitivo conforme evidência aparecer -->\n"
        )

    template = f"""# Learner Profile — {{{{LEARNER_NAME}}}}
*Perfil dinâmico — atualizado conforme evidência aparece na sessão*

{cognitive_section}
## Invariantes Operacionais (Não Negociáveis)
1. Nunca tempo em relógio ("2h", "30min"). Use unidades atômicas ("uma sessão", "um ciclo de fase").
2. Pirâmide Invertida: Macro-Topologia (1) ➔ Tracer Bullet (2) ➔ Quebrar Bordas (3) ➔ Nota de Arquitetura 1 página (4).
3. Propriedade do Código: {{{{LEARNER_NAME}}}} escreve o código central na Fase 2. IA fornece apenas esqueleto de integração com lacunas nomeadas.
4. Paper-First Topology: Desenho dos invariantes no papel antes de abrir IDE ou codar.
5. Achar fatos é trabalho da IA: Leia estado e episódios antes de falar. NUNCA pergunte "onde paramos?".
6. Zero culpa / Sem moralização: Abandono é dado empírico. Registre o porquê e siga.
7. Uma única voz conversacional: Tutor/Navigator interage por padrão.

## Níveis por Stack
<!-- atualizado via update_working_memory: stack → iniciante/intermediário/avançado + evidência -->

## Calibração "Fácil" (Boilerplate → Tutor/Driver executa)
<!-- ex: setup, pyproject, build scripts, integração de dados crua -->

## Padrões de Bloqueio Observados
<!-- registrado via update_working_memory conforme padrões recorrentes aparecem, com data -->

## Política de Rewards & Alavancagem
<!-- O que funcionou / o que não funcionou nesta fase -->

## Microvitórias & Provas de Realidade Recentes
✅
"""
    return personalize(template, profile)


def get_working_memory() -> str:
    """Reads the persisted working memory doc, initializing it from the template on first use."""
    if WORKING_MEMORY_PATH.exists():
        return WORKING_MEMORY_PATH.read_text(encoding="utf-8")
    doc = build_learner_profile_template(learner_profile)
    WORKING_MEMORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    WORKING_MEMORY_PATH.write_text(doc, encoding="utf-8")
    return doc


def update_working_memory(section: Section, content: str) -> dict:
    """Atualiza uma seção do Learner Profile (working memory) — chame sempre que notar um
    fato duradouro sobre o aprendiz (nível de stack, padrão de bloqueio, microvitória, o que
    funcionou/não funcionou). Substitui a seção inteira pelo novo conteúdo.

    Args:
        section: Seção do Learner Profile a atualizar.
        content: Novo conteúdo completo da seção (substitui o anterior).
    """
    body = get_working_memory()
    header = f"## {_SECTION_HEADERS[section]}"
    # `[^\n]*` tolerates a header line with a trailing suffix (e.g. "Perfil
    # Cognitivo & Afetivo (GAI elevado, ...)" when a cognitive_tag is set) —
    # match on the header prefix, not the exact full line.
    pattern = re.compile(rf"{re.escape(header)}[^\n]*\n[\s\S]*?(?=\n## |$)")
    replacement = f"{header}\n{content}\n"
    body = (
        pattern.sub(replacement, body, count=1)
        if pattern.search(body)
        else f"{body}\n{replacement}"
    )
    WORKING_MEMORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    WORKING_MEMORY_PATH.write_text(body, encoding="utf-8")
    return {"ok": True}


def inject_working_memory() -> str:
    """Registered as a dynamic `@agent.instructions` hook on every agent — returns the
    current working memory doc fresh on every call (unlike `personalize()`'d static
    instructions, which freeze at agent-construction/server-boot time)."""
    return get_working_memory()
