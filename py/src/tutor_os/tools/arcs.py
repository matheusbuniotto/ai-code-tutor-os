"""Port of src/mastra/tools/arcs.ts."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Literal, TypedDict

from tutor_os.storage import WORKSPACE_ROOT

ARCS_FILE = WORKSPACE_ROOT / "_meta" / "ARCS.json"

ArcStatus = Literal["in_progress", "mastered", "backlog"]


class CapabilityItem(TypedDict, total=False):
    id: str
    title: str
    verified: bool
    evidence: str
    evidenceIds: list[str]
    verifiedAt: str


class CapabilityArc(TypedDict, total=False):
    id: str
    title: str
    description: str
    color: str
    status: ArcStatus
    capabilities: list[CapabilityItem]
    linkedProjects: list[str]
    updatedAt: str


DEFAULT_ARCS: list[CapabilityArc] = [
    {
        "id": "arc1_behavior",
        "title": "Arco 1: Investigação e Julgamento de Comportamento de Software",
        "description": "Construir intuição física e capacidade analítica sobre execução, saturação, contenção de concorrência e falhas.",
        "color": "emerald",
        "status": "in_progress",
        "capabilities": [
            {
                "id": "cap-lock-contention",
                "title": "Diagnosticar contenção de locks sob concorrência paralela",
                "verified": True,
                "evidence": "Benchmark em Rust variando de 1 a 64 threads com Mutex vs RwLock.",
            },
            {
                "id": "cap-wal-io-saturation",
                "title": "Prever e mitigar saturação de I/O em Write-Ahead Logging (WAL)",
                "verified": True,
                "evidence": "Demonstrou limite de fsync sequencial e implementou group commit.",
            },
            {
                "id": "cap-idempotent-execution",
                "title": "Projetar mecanismos de execução idempotente e recuperação pós-falha",
                "verified": False,
                "evidence": "",
            },
            {
                "id": "cap-memory-layout-cache",
                "title": "Julgar trade-offs de layout de memória (AoS vs SoA) e cache locality",
                "verified": False,
                "evidence": "",
            },
        ],
        "linkedProjects": ["eda-for-ai-rust"],
    },
    {
        "id": "arc2_systems",
        "title": "Arco 2: Raciocínio sobre Sistemas Distribuídos e Recursos",
        "description": "Compreender trade-offs reais de dados, comunicação entre serviços, limites de SO, particionamento e confiabilidade.",
        "color": "sky",
        "status": "in_progress",
        "capabilities": [
            {
                "id": "cap-lsm-compaction",
                "title": "Calcular e mitigar Write Amplification em árvores LSM",
                "verified": False,
                "evidence": "",
            },
            {
                "id": "cap-backpressure",
                "title": "Implementar controle de fluxo e backpressure reativo sob sobrecarga",
                "verified": False,
                "evidence": "",
            },
            {
                "id": "cap-distributed-consensus",
                "title": "Modelar garantias e trade-offs de consistência eventual vs linearizabilidade",
                "verified": False,
                "evidence": "",
            },
        ],
        "linkedProjects": ["eda-for-ai-rust"],
    },
    {
        "id": "arc3_ai_systems",
        "title": "Arco 3: Julgamento e Engenharia de Sistemas de IA",
        "description": "Dominar contexto, recuperação vetorial, orquestração de ferramentas, avaliação quantitativa e confiabilidade de agentes.",
        "color": "purple",
        "status": "in_progress",
        "capabilities": [
            {
                "id": "cap-agent-evals",
                "title": "Desenhar suites de avaliação comportamental determinística para agentes",
                "verified": False,
                "evidence": "",
            },
            {
                "id": "cap-context-distillation",
                "title": "Otimizar compressão e destilação de contexto sem perda de raciocínio",
                "verified": False,
                "evidence": "",
            },
            {
                "id": "cap-tool-failure-modes",
                "title": "Construir guardrails para recuperação de falhas em tool calls não confiáveis",
                "verified": False,
                "evidence": "",
            },
        ],
        "linkedProjects": [],
    },
]


def read_arcs_data() -> list[CapabilityArc]:
    try:
        if ARCS_FILE.exists():
            return json.loads(ARCS_FILE.read_text(encoding="utf-8"))
    except Exception as err:  # noqa: BLE001
        print(f"Error reading ARCS.json, falling back to defaults: {err}")
    save_arcs_data(DEFAULT_ARCS)
    return DEFAULT_ARCS


def save_arcs_data(arcs: list[CapabilityArc]) -> None:
    ARCS_FILE.parent.mkdir(parents=True, exist_ok=True)
    ARCS_FILE.write_text(
        json.dumps(arcs, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def arcs_list() -> dict:
    """Retorna todos os Arcos de Capacidade customizados e planejados do aprendiz com metas e evidências verificadas."""
    return {"arcs": read_arcs_data()}


def arc_create_or_update(
    id: str,
    title: str,
    description: str,
    color: str = "emerald",
    status: ArcStatus = "in_progress",
    linked_projects: list[str] | None = None,
    capabilities: list[CapabilityItem] | None = None,
) -> dict:
    """Cria ou atualiza um Arco de Capacidade customizado.

    Args:
        id: ID único do arco (ex: arc-rust-lowlevel, arc-db-internals).
        title: Título do arco de capacidade.
        description: Objetivo de modelo mental e julgamento técnico.
        color: Cor do badge (emerald, sky, purple, amber, rose, indigo).
        status: in_progress | mastered | backlog.
        linked_projects: Slugs de projetos vinculados.
        capabilities: Metas de capacidade do arco.
    """
    arcs = read_arcs_data()
    idx = next((i for i, a in enumerate(arcs) if a["id"] == id), -1)
    existing = arcs[idx] if idx >= 0 else None

    updated_arc: CapabilityArc = {
        "id": id,
        "title": title,
        "description": description,
        "color": color or (existing or {}).get("color", "emerald"),
        "status": status or (existing or {}).get("status", "in_progress"),
        "linkedProjects": linked_projects
        if linked_projects is not None
        else (existing or {}).get("linkedProjects", []),
        "capabilities": capabilities
        if capabilities is not None
        else (existing or {}).get("capabilities", []),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    if idx >= 0:
        arcs[idx] = updated_arc
    else:
        arcs.append(updated_arc)

    save_arcs_data(arcs)
    return {"ok": True, "arc": updated_arc}


def capability_verify(arc_id: str, capability_id: str, evidence: str) -> dict:
    """[HARVESTER / REVIEWER] Registra evidência empírica verificada para uma meta de capacidade dentro de um Arco."""
    arcs = read_arcs_data()
    arc = next((a for a in arcs if a["id"] == arc_id), None)
    if not arc:
        raise ValueError(f"Arco não encontrado: {arc_id}")

    cap = next((c for c in arc["capabilities"] if c["id"] == capability_id), None)
    now = datetime.now(timezone.utc).isoformat()
    if cap:
        cap["verified"] = True
        cap["evidence"] = evidence
        cap["verifiedAt"] = now
    else:
        arc["capabilities"].append(
            {
                "id": capability_id,
                "title": capability_id,
                "verified": True,
                "evidence": evidence,
                "verifiedAt": now,
            }
        )

    save_arcs_data(arcs)
    return {"ok": True}


def arc_delete(arc_id: str) -> dict:
    """Exclui um arco de capacidade pelo ID."""
    arcs = [a for a in read_arcs_data() if a["id"] != arc_id]
    save_arcs_data(arcs)
    return {"ok": True}


def arcs_snapshot_and_reset(reason: str | None = None) -> dict:
    """Salva o ARCS.json atual em workspace/_meta/archive/ e zera os arcos ativos para começar do zero.

    Nunca perde evidência verificada. Use quando o aprendiz quer "esquecer" o
    roadmap/arcos anteriores sem destruir a evidência já verificada — não use
    arc_delete ou reescrita manual do arquivo pra isso.
    """
    arcs = read_arcs_data()
    archive_dir = WORKSPACE_ROOT / "_meta" / "archive"
    archive_dir.mkdir(parents=True, exist_ok=True)

    timestamp = (
        datetime.now(timezone.utc).isoformat().replace(":", "-").replace(".", "-")
    )
    snapshot_path = archive_dir / f"ARCS-{timestamp}.json"
    snapshot_path.write_text(
        json.dumps(
            {
                "archivedAt": datetime.now(timezone.utc).isoformat(),
                "reason": reason or "",
                "arcs": arcs,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    save_arcs_data([])
    return {"ok": True, "snapshotPath": str(snapshot_path), "archivedArcs": len(arcs)}
