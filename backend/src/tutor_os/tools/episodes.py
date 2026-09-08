"""Episodic memory: one JSONL record per closed session."""

from __future__ import annotations

from typing import Literal, TypedDict

from tutor_os.storage import META_DIR, append_jsonl, read_jsonl, write_jsonl

EPISODES_PATH = META_DIR / "EPISODES.jsonl"

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
    return read_jsonl(EPISODES_PATH)


def write_episodes(episodes: list[Episode]) -> None:
    write_jsonl(EPISODES_PATH, episodes)


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
    """[HARVESTER ONLY] Records the session episode in episodic memory (JSONL).

    Call exactly once when closing the session.

    Args:
        date: YYYY-MM-DD.
        project_slug: Project slug.
        topic: Session topic.
        phase_reached: Phase reached (0-4).
        status: em-andamento | concluido | pausado | abandonado.
        extracted: 1-3 lines: what they actually understood/built.
        connections: connections to other topics; include >=1 named speculative one.
        blockages: observed blockages, if any.
    """
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
    append_jsonl(EPISODES_PATH, episode)
    return {"ok": True, "totalEpisodes": len(read_episodes())}


def episodes_recent(limit: int = 5, project_slug: str | None = None) -> dict:
    """Session step 0: lists the last N episodes (most recent first).

    Use together with state_read to resume context without asking "where did we leave off".

    Args:
        limit: How many episodes to return (1-20).
        project_slug: Filter by project.
    """
    episodes = read_episodes()
    if project_slug:
        episodes = [e for e in episodes if e.get("projectSlug") == project_slug]
    return {"episodes": episodes[-limit:][::-1]}


def episodes_delete(
    index: int | str | None = None,
    date: str | None = None,
    project_slug: str | None = None,
    topic: str | None = None,
) -> dict:
    """Deletes a specific episode from episodic memory by index, or by date and project_slug."""
    episodes = read_episodes()
    idx: int | None = None
    if index is not None:
        try:
            idx = int(index)
        except (ValueError, TypeError):
            idx = None

    if idx is not None and 0 <= idx < len(episodes):
        remaining = [e for i, e in enumerate(episodes) if i != idx]
    elif date and project_slug:
        remaining = [
            e
            for e in episodes
            if not (
                e.get("date") == date
                and e.get("projectSlug") == project_slug
                and (
                    not topic
                    or topic == e.get("topic")
                    or (e.get("topic") and (topic in e["topic"] or e["topic"] in topic))
                )
            )
        ]
    elif topic:
        remaining = [
            e
            for e in episodes
            if not (
                topic == e.get("topic")
                or (e.get("topic") and (topic in e["topic"] or e["topic"] in topic))
            )
        ]
    else:
        remaining = episodes
    write_episodes(remaining)
    return {"ok": True, "remaining": len(remaining)}


def episodes_clear() -> dict:
    """Completely clears all episodic-memory records."""
    write_episodes([])
    return {"ok": True}


def episodes_search(query: str) -> dict:
    """Searches past episodes by keyword (topic, extracted content, or connections).

    Use to recall "I've seen this before" across domains.

    Args:
        query: Keyword to match against topic, extracted content, and connections.
    """
    q = query.lower()
    matches = [
        {k: e[k] for k in ("date", "projectSlug", "topic", "extracted")}
        for e in read_episodes()
        if q in e["topic"].lower()
        or q in e["extracted"].lower()
        or any(q in c.lower() for c in e["connections"])
    ]
    return {"matches": matches}
