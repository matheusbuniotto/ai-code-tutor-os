"""Port of src/mastra/tools/state.ts.

Learner's dynamic state lives in workspace/_meta/PROFILE.md. Read: any agent
(state_read at session start — Step 0). Write: ONLY the Harvester
(single-writer principle) via state_update.
"""

from __future__ import annotations

import re
from typing import Literal

from tutor_os.storage import WORKSPACE_ROOT

PROFILE_PATH = WORKSPACE_ROOT / "_meta" / "PROFILE.md"

Section = Literal[
    "niveis-por-stack",
    "facil-boilerplate",
    "padroes-de-bloqueio",
    "politica-rewards",
    "microvitorias",
]

_SECTIONS: tuple[Section, ...] = (
    "niveis-por-stack",
    "facil-boilerplate",
    "padroes-de-bloqueio",
    "politica-rewards",
    "microvitorias",
)


def state_read() -> dict:
    """Step 0 obrigatório de sessão: retorna o perfil dinâmico do aprendiz.

    (níveis, padrões de bloqueio, rewards, microvitórias). Combine com working
    memory. NUNCA pergunte 'onde paramos' — este arquivo responde.
    """
    if PROFILE_PATH.exists():
        profile = PROFILE_PATH.read_text(encoding="utf-8")
    else:
        profile = "# PROFILE\n(vazio — primeira sessão; calibre antes de criar spec)"
    return {"profile": profile}


def state_update(section: Section, content: str) -> dict:
    """[SOMENTE HARVESTER] Atualiza uma seção do perfil dinâmico.

    Substitui a seção inteira pelo novo conteúdo.
    """
    if PROFILE_PATH.exists():
        body = PROFILE_PATH.read_text(encoding="utf-8")
    else:
        sections_block = "\n".join(f"## {s}\n" for s in _SECTIONS)
        body = f"# PROFILE (dinâmico)\n\n{sections_block}"

    header = f"## {section}"
    pattern = re.compile(rf"{re.escape(header)}\n[\s\S]*?(?=\n## |$)")
    replacement = f"{header}\n{content}\n"
    body = (
        pattern.sub(replacement, body, count=1)
        if pattern.search(body)
        else f"{body}\n{replacement}"
    )

    PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROFILE_PATH.write_text(body, encoding="utf-8")
    return {"ok": True}
