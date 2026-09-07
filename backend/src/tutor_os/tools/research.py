"""arXiv and web search for the Researcher."""

from __future__ import annotations

import time
from typing import Literal

import httpx

_CACHE_TTL_S = 60 * 60  # 1 hour
_paper_cache: dict[str, tuple[list[dict], int, float]] = {}
_web_cache: dict[str, tuple[list[dict], int, float]] = {}

_HEADERS = {
    "User-Agent": "TutorOS-Academic-Research/2.0 (mailto:research@tutor-os.dev)",
    "Accept": "application/json",
}


def _clean_text(s: str | None) -> str:
    return " ".join((s or "").split())


def _reconstruct_abstract(inverted_index: dict[str, list[int]] | None) -> str:
    if not inverted_index:
        return ""
    words: list[tuple[int, str]] = []
    for word, positions in inverted_index.items():
        for pos in positions:
            words.append((pos, word))
    words.sort(key=lambda w: w[0])
    return " ".join(w for _, w in words)


async def arxiv_search(
    query: str,
    max_results: int = 10,
    sort_by: Literal[
        "relevance", "submittedDate", "lastUpdatedDate", "citations", "cited_by_count"
    ] = "relevance",
    search_field: Literal["all", "ti", "au", "abs"] = "all",
) -> dict:
    """Searches real academic papers (arXiv, IEEE, ACM, OSDI, VLDB) by phrase or keywords.

    Returns multiple articles with citation counts, authors, abstracts, and
    direct links to ground the architecture.

    Args:
        query: Search term, e.g. "lsm tree write amplification".
        max_results: 1-50, default 10.
        sort_by: relevance | submittedDate | lastUpdatedDate | citations | cited_by_count.
        search_field: all | ti | au | abs (not used by the current API, kept for parity).
    """
    cache_key = f"{query.lower().strip()}:{max_results}:{sort_by}"
    cached = _paper_cache.get(cache_key)
    if cached and time.time() - cached[2] < _CACHE_TTL_S:
        return {"papers": cached[0], "totalMatches": cached[1]}

    try:
        sort_param = (
            "cited_by_count:desc"
            if sort_by in ("citations", "cited_by_count")
            else "relevance_score:desc"
        )
        per_page = min(50, max(5, max_results))
        url = "https://api.openalex.org/works"
        async with httpx.AsyncClient(timeout=8.0, headers=_HEADERS) as client:
            resp = await client.get(
                url, params={"search": query, "per-page": per_page, "sort": sort_param}
            )
            resp.raise_for_status()
            data = resp.json()

        results = data.get("results") or []
        total = (data.get("meta") or {}).get("count", len(results))

        papers = []
        for p in results:
            abstract = _reconstruct_abstract(p.get("abstract_inverted_index")) or _clean_text(
                p.get("display_name")
            )
            authors = [
                _clean_text((a.get("author") or {}).get("display_name"))
                for a in p.get("authorships") or []
            ]
            authors = [a for a in authors if a]
            title = _clean_text(p.get("display_name"))
            if not title:
                continue
            papers.append({
                "title": title,
                "authors": authors or ["Academic Research Group"],
                "summary": (abstract[:380] + "...") if len(abstract) > 380 else abstract,
                "published": str(p.get("publication_year") or ""),
                "url": p.get("doi")
                or (p.get("primary_location") or {}).get("landing_page_url")
                or p.get("id")
                or "",
                "citations": p.get("cited_by_count") or 0,
                "venue": _clean_text(
                    (p.get("primary_location") or {}).get("source", {}).get("display_name")
                    or "Academic Index"
                ),
            })

        if papers:
            _paper_cache[cache_key] = (papers, total, time.time())
            return {"papers": papers, "totalMatches": total}
    except Exception:
        pass

    return {"papers": [], "totalMatches": 0}


async def web_search(
    query: str,
    source: Literal["all", "web", "stackoverflow", "github", "wikipedia"] = "all",
    max_results: int = 6,
) -> dict:
    """Broad, free search across the technical web (StackOverflow, GitHub, Wikipedia, Hacker News).

    Returns articles, algorithm explanations, technical discussions,
    documentation, and real code implementations with no API key required.

    Args:
        query: Web search term.
        source: all | web | stackoverflow | github | wikipedia.
        max_results: 1-20, default 6.
    """
    cache_key = f"web:{source}:{query.lower().strip()}:{max_results}"
    cached = _web_cache.get(cache_key)
    if cached and time.time() - cached[2] < _CACHE_TTL_S:
        return {"results": cached[0], "totalMatches": cached[1]}

    aggregated: list[dict] = []

    async with httpx.AsyncClient(timeout=8.0, headers=_HEADERS) as client:
        if source in ("all", "web", "stackoverflow"):
            try:
                resp = await client.get(
                    "https://api.stackexchange.com/2.3/search/advanced",
                    params={
                        "order": "desc",
                        "sort": "relevance",
                        "q": query,
                        "site": "stackoverflow",
                        "pagesize": min(5, max_results),
                    },
                )
                resp.raise_for_status()
                for item in resp.json().get("items") or []:
                    aggregated.append({
                        "title": _clean_text(item.get("title")),
                        "snippet": f"Score: {item.get('score')} | Tags: {', '.join(item.get('tags') or [])} | Technical answer about behavior and implementation.",
                        "url": item.get("link")
                        or f"https://stackoverflow.com/q/{item.get('question_id')}",
                        "source": "StackOverflow",
                    })
            except Exception:
                pass

        if source in ("all", "web", "wikipedia"):
            try:
                resp = await client.get(
                    "https://en.wikipedia.org/w/api.php",
                    params={
                        "action": "query",
                        "list": "search",
                        "srsearch": query,
                        "format": "json",
                        "utf8": 1,
                        "srlimit": min(4, max_results),
                    },
                )
                resp.raise_for_status()
                for item in (resp.json().get("query") or {}).get("search") or []:
                    title = item.get("title", "")
                    snippet = item.get("snippet", "")
                    import re as _re

                    aggregated.append({
                        "title": _clean_text(title),
                        "snippet": _clean_text(_re.sub(r"<[^>]+>", "", snippet)),
                        "url": f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}",
                        "source": "Wikipedia",
                    })
            except Exception:
                pass

        if source in ("all", "web", "github"):
            try:
                resp = await client.get(
                    "https://api.github.com/search/repositories",
                    params={
                        "q": query,
                        "per_page": min(4, max_results),
                        "sort": "stars",
                    },
                    headers={**_HEADERS, "Accept": "application/vnd.github.v3+json"},
                )
                resp.raise_for_status()
                for repo in resp.json().get("items") or []:
                    aggregated.append({
                        "title": f"{repo.get('full_name')} ({repo.get('language') or 'Code'}) ★{repo.get('stargazers_count') or 0}",
                        "snippet": _clean_text(
                            repo.get("description") or "Reference open-source technical repository."
                        ),
                        "url": repo.get("html_url") or "",
                        "source": "GitHub",
                    })
            except Exception:
                pass

        if source in ("all", "web"):
            try:
                resp = await client.get(
                    "https://hn.algolia.com/api/v1/search",
                    params={
                        "query": query,
                        "tags": "story",
                        "hitsPerPage": min(3, max_results),
                    },
                )
                resp.raise_for_status()
                for hit in resp.json().get("hits") or []:
                    if hit.get("title"):
                        aggregated.append({
                            "title": _clean_text(hit["title"]),
                            "snippet": f"Hacker News Points: {hit.get('points') or 0} | Comments: {hit.get('num_comments') or 0} | Engineering article and empirical discussion.",
                            "url": hit.get("url")
                            or f"https://news.ycombinator.com/item?id={hit.get('objectID')}",
                            "source": "HackerNews",
                        })
            except Exception:
                pass

    final_results = aggregated[:max_results]
    _web_cache[cache_key] = (final_results, len(aggregated), time.time())

    return {"results": final_results, "totalMatches": len(aggregated)}
