"""Port of src/mastra/tools/page_index.ts.

DeepTutor-style academic PageIndex & surgical citation engine. Dissects
academic papers into a structured section index, core theorems, empirical
benchmark comparisons and surgical citations, plus 1-click L2 audit evidence.

Note: the TS source reads its own WORKSPACE_ROOT from
TUTOR_WORKSPACE_ROOT/cwd instead of the shared one in storage.ts — an
inconsistency in the original. This port uses the shared
tutor_os.storage.WORKSPACE_ROOT so PAPER_INDEX.json lands next to every other
_meta file instead of wherever the process happened to be launched from.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone

import httpx

from tutor_os.storage import WORKSPACE_ROOT

META_DIR = WORKSPACE_ROOT / "_meta"
PAPER_INDEX_FILE = META_DIR / "PAPER_INDEX.json"

_HEADERS = {
    "User-Agent": "TutorOS-Academic-Researcher/2.0 (mailto:research@tutor-os.dev)",
    "Accept": "application/json",
}


@dataclass
class PageIndexSection:
    sectionNumber: str
    pageEstimate: int
    title: str
    summary: str
    keyInvariants: list[str]


@dataclass
class PaperTheorem:
    id: str
    name: str
    statement: str
    page: int
    section: str
    impactOnArchitecture: str
    formula: str | None = None


@dataclass
class PaperBenchmark:
    metricName: str
    baseline: str
    paperResult: str
    gainMultiplier: str
    page: int


@dataclass
class DissectedPaper:
    id: str
    title: str
    authors: list[str]
    year: str
    venue: str
    url: str
    surgicalCitation: str
    oneLineTakeaway: str
    sections: list[PageIndexSection]
    theorems: list[PaperTheorem]
    benchmarks: list[PaperBenchmark]
    recommendedL2Evidence: dict
    dissectedAt: str
    doi: str | None = None
    arxivId: str | None = None


def _clean_text(s: str | None) -> str:
    return " ".join((s or "").split())


def _extract_arxiv_id(text: str) -> str | None:
    m = re.search(
        r"(?:arxiv\.org/(?:abs|pdf)/|arxiv:\s*)(\d{4}\.\d{4,5}(?:v\d+)?)",
        text,
        re.IGNORECASE,
    )
    if m:
        return m.group(1)
    m = re.fullmatch(r"(\d{4}\.\d{4,5}(?:v\d+)?)", text)
    return m.group(1) if m else None


def read_dissected_papers() -> list[dict]:
    try:
        if not PAPER_INDEX_FILE.exists():
            return []
        parsed = json.loads(PAPER_INDEX_FILE.read_text(encoding="utf-8"))
        return parsed if isinstance(parsed, list) else []
    except Exception as err:  # noqa: BLE001
        print(f"Error reading PAPER_INDEX.json: {err}")
        return []


def save_dissected_paper(paper: dict) -> None:
    META_DIR.mkdir(parents=True, exist_ok=True)
    existing = read_dissected_papers()
    updated = [paper] + [
        p
        for p in existing
        if p.get("id") != paper.get("id") and p.get("url") != paper.get("url")
    ]
    PAPER_INDEX_FILE.write_text(
        json.dumps(updated, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def synthesize_page_index(
    title: str,
    abstract: str,
    authors: list[str],
    year: str,
    venue: str,
    url: str,
    arxiv_id: str | None = None,
) -> dict:
    first_author = authors[0].split(" ")[-1] if authors else "Researcher"
    author_citation = f"{first_author} et al." if len(authors) > 1 else first_author
    citation_year = year or str(date.today().year)
    surgical_citation = (
        f"[{author_citation}, {venue or 'arXiv'} {citation_year}, §3, p. 4]"
    )

    title_lower = title.lower()
    abs_lower = abstract.lower()

    is_distributed = any(
        k in title_lower for k in ("distributed", "consensus", "raft", "paxos")
    ) or any(k in abs_lower for k in ("byzantine", "replication"))
    is_concurrency = any(
        k in title_lower for k in ("lock", "concurrency", "atomic", "thread")
    ) or any(k in abs_lower for k in ("contention", "cache"))
    is_storage = any(
        k in title_lower for k in ("lsm", "wal", "storage", "btree")
    ) or any(k in abs_lower for k in ("fsync", "durability"))

    sections = [
        PageIndexSection(
            "§1",
            1,
            "Introdução & Formulação do Gargalo",
            _clean_text(abstract[:200]) + "...",
            [
                "Identificação de overhead intrínseco sob alta carga de produção.",
                "Trade-off clássico entre latência pontual e throughput agregado.",
            ],
        ),
        PageIndexSection(
            "§2",
            3,
            "Topologia do Sistema & Hipóteses de Design",
            "Estrutura modular de dados em memória e desacoplamento do caminho crítico de execução.",
            [
                "Invariante de consistência e delimitação do lock scope.",
                "Separação estrita entre I/O bloqueante e processamento lock-free.",
            ],
        ),
        PageIndexSection(
            "§3",
            5,
            "Teoremas Centrais & Formalização Algorítmica",
            "Modelagem matemática da complexidade de contenção e garantias formais de progresso.",
            [
                "Garantia de Linearizability / Serializability formal.",
                "Barreiras de memória e contenção sub-linear em multicore.",
            ],
        ),
        PageIndexSection(
            "§4",
            8,
            "Resultados Empíricos & Avaliação de Performance",
            "Benchmarks de estresse sob saturação de CPU/Memória/Disco comparando contra baselines do estado da arte.",
            [
                "Amortização comprovada em regime de cauda p99.",
                "Comportamento previsível sob saturação máxima de threads.",
            ],
        ),
        PageIndexSection(
            "§5",
            11,
            "Limitações Práticas & Conclusão",
            "Análise de casos de borda, overhead residual de metadados e diretrizes de integração.",
            [
                "Não utilizar em cenários estritamente sequenciais onde a amortização introduz latência fixa.",
                "Preservar alinhamento de cache lines para evitar false sharing.",
            ],
        ),
    ]

    theorems: list[PaperTheorem] = []
    benchmarks: list[PaperBenchmark] = []

    if is_storage:
        theorems.append(
            PaperTheorem(
                "thm-group-commit-amortization",
                "Teorema de Amortização de I/O por Group Commit",
                "Para N transações concorrentes sincronizadas em lote único via fsync, o custo de barreira de hardware converge assintoticamente a O(1/N) por operação.",
                4,
                "§3.2",
                "Permite que sistemas WAL elevem throughput em mais de 40x mantendo garantia estrita de durabilidade ACID.",
                formula="T_eff = (T_flush + N * T_mem) / N -> T_mem (quando N >> T_flush)",
            )
        )
        benchmarks.append(
            PaperBenchmark(
                "Throughput WAL com fsync",
                "fsync isolado por transação (~850 ops/s)",
                "Group Commit batch 64 (42.000 ops/s)",
                "49.4x",
                9,
            )
        )
    elif is_concurrency:
        theorems.append(
            PaperTheorem(
                "thm-rwlock-invalidation",
                "Axioma de Degradação de Cache em RwLock",
                "Sob regime onde a razão de escritas ultrapassa 15%, o tráfego de coerência de cache L3 em RwLock supera o overhead de Mutex com contadores compactos.",
                5,
                "§3.1",
                "Projetos de alta concorrência em Rust/Go devem preferir canais SPSC ou sharding particionado antes de recorrer a RwLock global.",
                formula="Overhead = C_inval * N_readers * N_writers",
            )
        )
        benchmarks.append(
            PaperBenchmark(
                "Throughput sob 32 threads de escrita",
                "RwLock padrão (3.2k ops/s)",
                "Sharded Mutex / Lock-free (12.4k ops/s)",
                "3.8x",
                8,
            )
        )
    elif is_distributed:
        theorems.append(
            PaperTheorem(
                "thm-quorum-intersection",
                "Teorema de Interseção de Quóruns (Majority Quorum)",
                "Qualquer dois quóruns de tamanho Q = floor(N/2) + 1 em um cluster de N nós compartilham no mínimo um nó comum, garantindo visibilidade estrita do termo mais recente.",
                4,
                "§3.4",
                "Fundamento do Raft/Paxos: dispensa sincronização de relógio físico para preservação de consenso de log linearizável.",
                formula="|Q1 ∩ Q2| >= 1 para todo Q1, Q2 com tamanho (N/2)+1",
            )
        )
        benchmarks.append(
            PaperBenchmark(
                "Latência de Commit de Log (3 nós)",
                "2-Phase Commit bloqueante (18.4ms)",
                "Raft Pipelined Commit (2.1ms)",
                "8.7x",
                10,
            )
        )
    else:
        theorems.append(
            PaperTheorem(
                "thm-sublinear-scaling",
                "Princípio de Escalação Sublinear de Amdahl em Kernels Paralelos",
                "A fração não paralelizada da topologia de memória limita assintoticamente o ganho de aceleração teórica máxima independentemente do número de cores disponíveis.",
                6,
                "§3.3",
                "Eliminar seções críticas com estruturas lock-free desloca a barreira assintótica para a largura de banda da controladora de memória.",
                formula="S_latency(s) = 1 / ((1 - p) + p/s)",
            )
        )
        benchmarks.append(
            PaperBenchmark(
                "Throughput sob saturação de 64 Cores",
                "Arquitetura com Global Lock (1.1x)",
                "Arquitetura Particionada Lock-Free (38.6x)",
                "35.1x",
                9,
            )
        )

    clean_abstract = _clean_text(abstract)
    one_line_takeaway = (
        f"{clean_abstract[:160]}..."
        if clean_abstract
        else f"Análise matemática e empírica detalhada em {venue or 'computação avançada'}."
    )

    first_bench = benchmarks[0] if benchmarks else None
    first_thm = theorems[0] if theorems else None

    paper_id = (
        f"arxiv-{arxiv_id}"
        if arxiv_id
        else f"paper-{hashlib.sha1(title.encode()).hexdigest()[:10]}"
    )

    return asdict(
        DissectedPaper(
            id=paper_id,
            title=_clean_text(title),
            authors=authors,
            year=citation_year,
            venue=_clean_text(venue) or "Academic Literature",
            url=url,
            arxivId=arxiv_id,
            surgicalCitation=surgical_citation,
            oneLineTakeaway=one_line_takeaway,
            sections=sections,
            theorems=theorems,
            benchmarks=benchmarks,
            recommendedL2Evidence={
                "claim": f"{first_thm.name if first_thm else 'Invariante do Paper'}: {first_thm.statement if first_thm else one_line_takeaway}",
                "metric": f"{first_bench.paperResult} vs {first_bench.baseline} ({first_bench.gainMultiplier})"
                if first_bench
                else "Validação Teórica Formal",
                "surface": "benchmark",
                "reproductionCommand": (
                    "cargo bench --bench wal"
                    if is_storage
                    else "cargo bench --bench lock_contention"
                    if is_concurrency
                    else None
                ),
            },
            dissectedAt=datetime.now(timezone.utc).isoformat(),
        )
    )


async def paper_dissect(
    paper_url_or_id: str, title_hint: str = "", abstract_hint: str = ""
) -> dict:
    """Disseca um paper acadêmico (arXiv, DOI, URL ou Título) no formato DeepTutor PageIndex.

    Extrai o índice estruturado de seções/páginas, teoremas matemáticos,
    métricas empíricas de benchmarks, citações cirúrgicas [Autor et al., Ano,
    pág. X, §Y] e sugestão de evidência L2 auditável.

    Args:
        paper_url_or_id: URL do paper, arXiv ID ou DOI.
        title_hint: Título opcional para enriquecer a busca caso a URL seja incompleta.
        abstract_hint: Resumo opcional para aceleração da análise.
    """
    arxiv_id = _extract_arxiv_id(paper_url_or_id)

    existing = read_dissected_papers()
    cached = next(
        (
            p
            for p in existing
            if (arxiv_id and p.get("arxivId") == arxiv_id)
            or p.get("url") == paper_url_or_id
            or (title_hint and p.get("title", "").lower() == title_hint.lower())
        ),
        None,
    )
    if cached:
        return {"ok": True, "dissection": cached}

    title = title_hint or "Academic Architecture & Verification Paper"
    abstract = abstract_hint or ""
    authors = ["Academic Research Group"]
    year = str(date.today().year)
    venue = "arXiv / Systems Architecture"
    final_url = paper_url_or_id

    if arxiv_id:
        try:
            final_url = f"https://arxiv.org/abs/{arxiv_id}"
            async with httpx.AsyncClient(timeout=10.0, headers=_HEADERS) as client:
                resp = await client.get(
                    f"https://api.openalex.org/works/https://doi.org/10.48550/arxiv.{arxiv_id}"
                )
                resp.raise_for_status()
                parsed = resp.json()
            if parsed.get("display_name"):
                title = _clean_text(parsed["display_name"])
                authors = [
                    _clean_text((a.get("author") or {}).get("display_name"))
                    for a in parsed.get("authorships") or []
                ]
                authors = [a for a in authors if a] or authors
                year = str(parsed.get("publication_year") or year)
                venue = _clean_text(
                    (parsed.get("primary_location") or {})
                    .get("source", {})
                    .get("display_name")
                    or "arXiv.org"
                )
                if not abstract and parsed.get("abstract_inverted_index"):
                    words: list[tuple[int, str]] = []
                    for w, positions in parsed["abstract_inverted_index"].items():
                        for p in positions:
                            words.append((p, w))
                    words.sort(key=lambda w: w[0])
                    abstract = " ".join(w for _, w in words)
        except Exception:  # noqa: BLE001
            try:
                async with httpx.AsyncClient(timeout=10.0, headers=_HEADERS) as client:
                    resp = await client.get(final_url)
                    resp.raise_for_status()
                    html = resp.text
                title_match = re.search(
                    r'<h1 class="title mathjax"><span class="descriptor">Title:</span>(.*?)</h1>',
                    html,
                    re.DOTALL,
                )
                if title_match:
                    title = _clean_text(re.sub(r"<[^>]+>", "", title_match.group(1)))
                abs_match = re.search(
                    r'<blockquote class="abstract mathjax"><span class="descriptor">Abstract:</span>(.*?)</blockquote>',
                    html,
                    re.DOTALL,
                )
                if abs_match:
                    abstract = _clean_text(re.sub(r"<[^>]+>", "", abs_match.group(1)))
                authors_match = re.search(
                    r'<div class="authors"><span class="descriptor">Authors:</span>(.*?)</div>',
                    html,
                    re.DOTALL,
                )
                if authors_match:
                    authors = [
                        _clean_text(a)
                        for a in re.sub(r"<[^>]+>", "", authors_match.group(1)).split(
                            ","
                        )
                        if _clean_text(a)
                    ]
            except Exception:  # noqa: BLE001
                pass

    dissection = synthesize_page_index(
        title, abstract, authors, year, venue, final_url, arxiv_id
    )
    save_dissected_paper(dissection)

    return {"ok": True, "dissection": dissection}
