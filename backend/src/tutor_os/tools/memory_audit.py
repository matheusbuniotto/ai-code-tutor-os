"""Port of src/mastra/tools/memory_audit.ts."""

from __future__ import annotations

import json
import random
import string
from datetime import UTC, date, datetime
from typing import Literal, TypedDict

from tutor_os.storage import WORKSPACE_ROOT
from tutor_os.tools.arcs import (
    read_arcs_data,
    save_arcs_data,
)
from tutor_os.tools.episodes import read_episodes

EVIDENCES_FILE = WORKSPACE_ROOT / "_meta" / "EVIDENCES.json"
TRACES_DIR = WORKSPACE_ROOT / "_meta" / "traces"

Surface = Literal["benchmark", "code_review", "architecture_note", "challenge", "rescue", "chat"]
VerifiedBy = Literal["reviewer", "harvester", "system", "assigner"]


class L2Evidence(TypedDict, total=False):
    id: str
    sourceL1Id: str
    sourceRef: str | None
    surface: Surface
    claim: str
    metric: str | None
    reproductionCommand: str | None
    arcId: str | None
    capabilityId: str | None
    verifiedBy: VerifiedBy
    confidence: float
    verifiedAt: str
    notes: str | None


def _short_id(n: int = 4) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def read_evidences() -> list[L2Evidence]:
    try:
        if not EVIDENCES_FILE.exists():
            now = datetime.now(UTC).isoformat()
            default_evidences: list[L2Evidence] = [
                {
                    "id": "ev-init-lock-contention",
                    "sourceL1Id": "ep-init-01",
                    "sourceRef": "workspace/eda-for-ai-rust/benchmarks/mutex_vs_rwlock.rs",
                    "surface": "benchmark",
                    "claim": "Under high write contention (32 threads), RwLock has 3.8x lower throughput than Mutex due to reader/writer cache-invalidation overhead.",
                    "metric": "Throughput: 12.4k ops/s (Mutex) vs 3.2k ops/s (RwLock)",
                    "reproductionCommand": "cargo bench --bench lock_contention",
                    "arcId": "arc1_behavior",
                    "capabilityId": "cap-lock-contention",
                    "verifiedBy": "reviewer",
                    "confidence": 1.0,
                    "verifiedAt": now,
                    "notes": "Audited with a latency profile and L3 cache counters.",
                },
                {
                    "id": "ev-init-wal-saturation",
                    "sourceL1Id": "ep-init-02",
                    "sourceRef": "workspace/rust-wal-bench/src/wal.rs",
                    "surface": "benchmark",
                    "claim": "Sequential fsync per transaction saturates the drive at ~850 ops/s; Group Commit in batches of 64 raises it to 42,000 ops/s while keeping ACID durability.",
                    "metric": "42,000 ops/s with p99 < 1.4ms (Group Commit 64)",
                    "reproductionCommand": "cargo run --release -- --bench-wal",
                    "arcId": "arc1_behavior",
                    "capabilityId": "cap-wal-io-saturation",
                    "verifiedBy": "reviewer",
                    "confidence": 1.0,
                    "verifiedAt": now,
                    "notes": "Proven via physical amortization of NVMe disk flush time.",
                },
            ]
            write_evidences(default_evidences)
            return default_evidences
        raw = json.loads(EVIDENCES_FILE.read_text(encoding="utf-8"))
        return raw if isinstance(raw, list) else []
    except Exception as err:
        print(f"Error reading EVIDENCES.json: {err}")
        return []


def write_evidences(evidences: list[L2Evidence]) -> None:
    WORKSPACE_ROOT.joinpath("_meta").mkdir(parents=True, exist_ok=True)
    TRACES_DIR.mkdir(parents=True, exist_ok=True)
    EVIDENCES_FILE.write_text(json.dumps(evidences, indent=2, ensure_ascii=False), encoding="utf-8")


def get_full_memory_graph() -> dict:
    arcs = read_arcs_data()
    evidences = read_evidences()
    episodes = read_episodes()

    l1_traces = []
    for idx, ep in enumerate(episodes):
        l1_traces.append({
            "id": f"ep-{ep['date'].replace('-', '')}-{idx + 1:02d}",
            "index": idx,
            "type": "session",
            "timestamp": ep["date"],
            "projectSlug": ep.get("projectSlug"),
            "topic": ep.get("topic"),
            "summary": f"{ep.get('projectSlug', 'OS')}: {ep.get('topic', 'Session')} (Phase {ep.get('phaseReached', 1)}, {ep.get('status', 'em-andamento')}) — {ep.get('extracted', '')}",
            "source": "workspace/_meta/EPISODES.jsonl",
            "rawRef": ep.get("extracted"),
        })

    total_verified_caps = 0
    caps_with_evidence = 0
    l3_arcs = []
    for arc in arcs:
        cap_rows = []
        for cap in arc.get("capabilities", []):
            matched = [
                e
                for e in evidences
                if e.get("capabilityId") == cap["id"]
                or (
                    e.get("arcId") == arc["id"]
                    and cap["title"].lower()[:15] in e.get("claim", "").lower()
                )
            ]
            if cap.get("verified"):
                total_verified_caps += 1
                if matched:
                    caps_with_evidence += 1
            cap_rows.append({
                "id": cap["id"],
                "title": cap["title"],
                "verified": cap.get("verified", False),
                "evidenceIds": [e["id"] for e in matched],
            })
        l3_arcs.append({
            "id": arc["id"],
            "title": arc["title"],
            "status": arc["status"],
            "color": arc["color"],
            "capabilities": cap_rows,
        })

    audit_health_score = (
        round((caps_with_evidence / total_verified_caps) * 100) if total_verified_caps > 0 else 100
    )

    return {
        "l3": {
            "profileSummary": "User Profile — Auditable Technical Judgment Profile",
            "arcs": l3_arcs,
        },
        "l2": evidences,
        "l1": l1_traces,
        "stats": {
            "totalL1Traces": len(l1_traces),
            "totalL2Evidences": len(evidences),
            "verifiedCapabilities": total_verified_caps,
            "auditHealthScore": audit_health_score,
        },
    }


def evidence_record(
    claim: str,
    metric: str | None = None,
    source_l1_id: str | None = None,
    source_ref: str | None = None,
    surface: Surface = "benchmark",
    reproduction_command: str | None = None,
    arc_id: str | None = None,
    capability_id: str | None = None,
    confidence: float = 1.0,
    notes: str | None = None,
) -> dict:
    """[REVIEWER / HARVESTER] Records an auditable L2 fact with an explicit pointer to the L1 trace and the L3 Arc.

    Use whenever a benchmark, test, or challenge has been proven.

    Args:
        claim: Concrete technical statement or proven empirical conclusion.
        metric: Measurable metric (e.g. 'p99 < 1.2ms @ 45k ops/s').
        source_l1_id: ID of the source L1 trace or episode.
        source_ref: Path to the code/benchmark file or log.
        surface: benchmark | code_review | architecture_note | challenge | rescue | chat.
        reproduction_command: Exact command to reproduce it.
        arc_id: ID of the linked Capability Arc.
        capability_id: ID of the specific capability proven.
        confidence: Confidence (0-1).
        notes: Additional notes.
    """
    evidences = read_evidences()
    ev_id = f"ev-{date.today().isoformat().replace('-', '')}-{_short_id()}"
    source_l1_id = source_l1_id or f"ep-{date.today().isoformat().replace('-', '')}-01"

    new_evidence: L2Evidence = {
        "id": ev_id,
        "claim": claim,
        "metric": metric,
        "sourceL1Id": source_l1_id,
        "sourceRef": source_ref,
        "surface": surface,
        "reproductionCommand": reproduction_command,
        "arcId": arc_id,
        "capabilityId": capability_id,
        "verifiedBy": "reviewer",
        "confidence": confidence,
        "verifiedAt": datetime.now(UTC).isoformat(),
        "notes": notes,
    }

    evidences.append(new_evidence)
    write_evidences(evidences)

    if capability_id:
        try:
            arcs = read_arcs_data()
            for arc in arcs:
                cap = next((c for c in arc["capabilities"] if c["id"] == capability_id), None)
                if cap:
                    cap["verified"] = True
                    cap["evidence"] = claim
                    cap["evidenceIds"] = sorted(set((cap.get("evidenceIds") or []) + [ev_id]))
                    cap["verifiedAt"] = datetime.now(UTC).isoformat()
                    break
            save_arcs_data(arcs)
        except Exception as err:
            print(f"Error auto-syncing capability in ARCS.json: {err}")

    return {
        "ok": True,
        "evidenceId": ev_id,
        "totalEvidences": len(evidences),
        "auditChain": f"L3 ({arc_id or 'Meta'}) ➔ L2 ({ev_id}) ➔ L1 ({source_l1_id})",
    }


def evidence_list(
    arc_id: str | None = None, surface: str | None = None, search: str | None = None
) -> dict:
    """Lists and searches the collection of auditable L2 facts and evidence backing the profile's capabilities."""
    evidences = read_evidences()
    if arc_id:
        evidences = [e for e in evidences if e.get("arcId") == arc_id]
    if surface:
        evidences = [e for e in evidences if e.get("surface") == surface]
    if search:
        q = search.lower()
        evidences = [
            e
            for e in evidences
            if q in e.get("claim", "").lower() or q in (e.get("metric") or "").lower()
        ]
    return {"evidences": evidences, "total": len(evidences)}
