"""Port of src/mastra/tools/arcs.ts."""

from __future__ import annotations

import json
from datetime import UTC, datetime
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
        "title": "Arc 1: Investigation and Judgment of Software Behavior",
        "description": "Build physical intuition and analytical ability about execution, saturation, concurrency contention, and failures.",
        "color": "emerald",
        "status": "in_progress",
        "capabilities": [
            {
                "id": "cap-lock-contention",
                "title": "Diagnose lock contention under parallel concurrency",
                "verified": True,
                "evidence": "Rust benchmark ranging from 1 to 64 threads with Mutex vs RwLock.",
            },
            {
                "id": "cap-wal-io-saturation",
                "title": "Predict and mitigate I/O saturation in Write-Ahead Logging (WAL)",
                "verified": True,
                "evidence": "Demonstrated the sequential fsync limit and implemented group commit.",
            },
            {
                "id": "cap-idempotent-execution",
                "title": "Design idempotent execution and post-failure recovery mechanisms",
                "verified": False,
                "evidence": "",
            },
            {
                "id": "cap-memory-layout-cache",
                "title": "Judge memory layout trade-offs (AoS vs SoA) and cache locality",
                "verified": False,
                "evidence": "",
            },
        ],
        "linkedProjects": ["eda-for-ai-rust"],
    },
    {
        "id": "arc2_systems",
        "title": "Arc 2: Reasoning About Distributed Systems and Resources",
        "description": "Understand real trade-offs in data, inter-service communication, OS limits, partitioning, and reliability.",
        "color": "sky",
        "status": "in_progress",
        "capabilities": [
            {
                "id": "cap-lsm-compaction",
                "title": "Calculate and mitigate Write Amplification in LSM trees",
                "verified": False,
                "evidence": "",
            },
            {
                "id": "cap-backpressure",
                "title": "Implement flow control and reactive backpressure under overload",
                "verified": False,
                "evidence": "",
            },
            {
                "id": "cap-distributed-consensus",
                "title": "Model eventual-consistency vs. linearizability guarantees and trade-offs",
                "verified": False,
                "evidence": "",
            },
        ],
        "linkedProjects": ["eda-for-ai-rust"],
    },
    {
        "id": "arc3_ai_systems",
        "title": "Arc 3: Judgment and Engineering of AI Systems",
        "description": "Master context, vector retrieval, tool orchestration, quantitative evaluation, and agent reliability.",
        "color": "purple",
        "status": "in_progress",
        "capabilities": [
            {
                "id": "cap-agent-evals",
                "title": "Design deterministic behavioral evaluation suites for agents",
                "verified": False,
                "evidence": "",
            },
            {
                "id": "cap-context-distillation",
                "title": "Optimize context compression and distillation without losing reasoning",
                "verified": False,
                "evidence": "",
            },
            {
                "id": "cap-tool-failure-modes",
                "title": "Build guardrails for recovering from unreliable tool-call failures",
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
    except Exception as err:
        print(f"Error reading ARCS.json, falling back to defaults: {err}")
    save_arcs_data(DEFAULT_ARCS)
    return DEFAULT_ARCS


def save_arcs_data(arcs: list[CapabilityArc]) -> None:
    ARCS_FILE.parent.mkdir(parents=True, exist_ok=True)
    ARCS_FILE.write_text(json.dumps(arcs, indent=2, ensure_ascii=False), encoding="utf-8")


def arcs_list() -> dict:
    """Returns all of the learner's custom and planned Capability Arcs, with goals and verified evidence."""
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
    """Creates or updates a custom Capability Arc.

    Args:
        id: Unique arc ID (e.g. arc-rust-lowlevel, arc-db-internals).
        title: Capability arc title.
        description: Mental-model and technical-judgment goal.
        color: Badge color (emerald, sky, purple, amber, rose, indigo).
        status: in_progress | mastered | backlog.
        linked_projects: Slugs of linked projects.
        capabilities: Capability goals for the arc.
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
        "updatedAt": datetime.now(UTC).isoformat(),
    }

    if idx >= 0:
        arcs[idx] = updated_arc
    else:
        arcs.append(updated_arc)

    save_arcs_data(arcs)
    return {"ok": True, "arc": updated_arc}


def capability_verify(arc_id: str, capability_id: str, evidence: str) -> dict:
    """[HARVESTER / REVIEWER] Records verified empirical evidence for a capability goal within an Arc."""
    arcs = read_arcs_data()
    arc = next((a for a in arcs if a["id"] == arc_id), None)
    if not arc:
        raise ValueError(f"Arc not found: {arc_id}")

    cap = next((c for c in arc["capabilities"] if c["id"] == capability_id), None)
    now = datetime.now(UTC).isoformat()
    if cap:
        cap["verified"] = True
        cap["evidence"] = evidence
        cap["verifiedAt"] = now
    else:
        arc["capabilities"].append({
            "id": capability_id,
            "title": capability_id,
            "verified": True,
            "evidence": evidence,
            "verifiedAt": now,
        })

    save_arcs_data(arcs)
    return {"ok": True}


def arc_delete(arc_id: str) -> dict:
    """Deletes a capability arc by ID."""
    arcs = [a for a in read_arcs_data() if a["id"] != arc_id]
    save_arcs_data(arcs)
    return {"ok": True}


def arcs_snapshot_and_reset(reason: str | None = None) -> dict:
    """Saves the current ARCS.json to workspace/_meta/archive/ and resets the active arcs to start from scratch.

    Never loses verified evidence. Use when the learner wants to "forget" the
    previous roadmap/arcs without destroying already-verified evidence — do
    not use arc_delete or a manual file rewrite for this.
    """
    arcs = read_arcs_data()
    archive_dir = WORKSPACE_ROOT / "_meta" / "archive"
    archive_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(UTC).isoformat().replace(":", "-").replace(".", "-")
    snapshot_path = archive_dir / f"ARCS-{timestamp}.json"
    snapshot_path.write_text(
        json.dumps(
            {
                "archivedAt": datetime.now(UTC).isoformat(),
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
