"""Port of src/mastra/tools/episodes.ts."""

from __future__ import annotations

import json
from typing import Literal, TypedDict

from tutor_os.storage import WORKSPACE_ROOT

EPISODES_PATH = WORKSPACE_ROOT / "_meta" / "EPISODES.jsonl"

Status = Literal["em-andamento", "concluido", "pausado", "abandonado"]


class Episode(TypedDict):
    date: str
    projectSlug: str
    topic: str
    phaseReached: int
    status: Status
    extracted: str
    blockages: str | None
    connections: list[str]


def read_episodes() -> list[Episode]:
    if not EPISODES_PATH.exists():
        return []
    lines = EPISODES_PATH.read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


def write_episodes(episodes: list[Episode]) -> None:
    EPISODES_PATH.parent.mkdir(parents=True, exist_ok=True)
    body = "\n".join(json.dumps(e, ensure_ascii=False) for e in episodes)
    if episodes:
        body += "\n"
    EPISODES_PATH.write_text(body, encoding="utf-8")


def episodes_append(
    date: str,
    project_slug: str,
    topic: str,
    phase_reached: int,
    status: Status,
    extracted: str,
    connections: list[str],
    blockages: str | None = None,
) -> dict:
    """[SOMENTE HARVESTER] Registra o episódio da sessão na memória episódica (JSONL).

    Chame uma única vez ao fechar a sessão.

    Args:
        date: AAAA-MM-DD.
        project_slug: Slug do projeto.
        topic: Tópico da sessão.
        phase_reached: Fase alcançada (0-4).
        status: em-andamento | concluido | pausado | abandonado.
        extracted: 1-3 linhas: o que ele efetivamente entendeu/construiu.
        connections: conexões com outros temas; inclua >=1 especulativa nomeada.
        blockages: bloqueios observados, se houver.
    """
    episodes = read_episodes()
    episode: Episode = {
        "date": date,
        "projectSlug": project_slug,
        "topic": topic,
        "phaseReached": phase_reached,
        "status": status,
        "extracted": extracted,
        "blockages": blockages,
        "connections": connections,
    }
    EPISODES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with EPISODES_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(episode, ensure_ascii=False) + "\n")
    return {"ok": True, "totalEpisodes": len(episodes) + 1}


def episodes_recent(limit: int = 5, project_slug: str | None = None) -> dict:
    """Step 0 de sessão: lista os últimos N episódios (mais recentes primeiro).

    Use junto de state_read para retomar contexto sem perguntar "onde paramos".

    Args:
        limit: Quantos episódios retornar (1-20).
        project_slug: Filtra por projeto.
    """
    episodes = read_episodes()
    if project_slug:
        episodes = [e for e in episodes if e["projectSlug"] == project_slug]
    tail = list(reversed(episodes[-limit:]))
    return {"episodes": tail}


def episodes_delete(
    index: int | None = None,
    date: str | None = None,
    project_slug: str | None = None,
    topic: str | None = None,
) -> dict:
    """Exclui um episódio específico da memória episódica por index ou por data e project_slug."""
    episodes = read_episodes()
    if index is not None and 0 <= index < len(episodes):
        filtered = [e for i, e in enumerate(episodes) if i != index]
    elif date and project_slug:

        def keep(e: Episode) -> bool:
            if e["date"] == date and e["projectSlug"] == project_slug:
                if topic and e["topic"] != topic:
                    return True
                return False
            return True

        filtered = [e for e in episodes if keep(e)]
    elif topic:
        filtered = [e for e in episodes if e["topic"] != topic]
    else:
        filtered = episodes
    write_episodes(filtered)
    return {"ok": True, "remaining": len(filtered)}


def episodes_clear() -> dict:
    """Limpa completamente todos os registros da memória episódica."""
    write_episodes([])
    return {"ok": True}


def episodes_search(query: str) -> dict:
    """Busca episódios passados por palavra-chave (tópico, extração ou conexões).

    Use para resgatar "eu já vi isso antes" entre domínios.
    """
    q = query.lower()
    episodes = read_episodes()
    matches = [
        {
            "date": e["date"],
            "projectSlug": e["projectSlug"],
            "topic": e["topic"],
            "extracted": e["extracted"],
        }
        for e in episodes
        if q in e["topic"].lower()
        or q in e["extracted"].lower()
        or any(q in c.lower() for c in e["connections"])
    ]
    return {"matches": matches}
