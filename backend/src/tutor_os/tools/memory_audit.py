"""Auditable memory graph: L1 episodes → L2 evidence → L3 capability arcs.

Every verified capability must trace back to a reproducible L2 fact; the audit
health score is the share of verified capabilities that actually do.
"""

from __future__ import annotations

import random
import string
from datetime import UTC, date, datetime
from typing import Literal, TypedDict

from tutor_os.storage import META_DIR, read_json, write_json
from tutor_os.tools.arcs import CapabilityItem, read_arcs_data, save_arcs_data
from tutor_os.tools.episodes import Episode, read_episodes

EVIDENCES_FILE = META_DIR / "EVIDENCES.json"
TRACES_DIR = META_DIR / "traces"

Surface = Literal["benchmark", "code_review", "architecture_note", "challenge", "rescue", "chat"]
VerifiedBy = Literal["reviewer", "harvester", "system", "assigner"]

_CLAIM_MATCH_PREFIX = 15


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


def short_id(n: int = 4) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def read_evidences() -> list[L2Evidence]:
    """Starts empty: seeding evidence would fabricate an audit trail nobody earned."""
    stored = read_json(EVIDENCES_FILE, [])
    return stored if isinstance(stored, list) else []


def write_evidences(evidences: list[L2Evidence]) -> None:
    TRACES_DIR.mkdir(parents=True, exist_ok=True)
    write_json(EVIDENCES_FILE, evidences)


def _evidence_for(
    arc_id: str, cap: CapabilityItem, evidences: list[L2Evidence]
) -> list[L2Evidence]:
    """Evidence explicitly tagged with the capability, plus same-arc claims that name it."""
    title_prefix = cap["title"].lower()[:_CLAIM_MATCH_PREFIX]
    return [
        e
        for e in evidences
        if e.get("capabilityId") == cap["id"]
        or (e.get("arcId") == arc_id and title_prefix in e.get("claim", "").lower())
    ]


def _episode_to_trace(index: int, ep: Episode) -> dict:
    ep_date = (ep.get("date") or "today").replace("-", "")
    return {
        "id": f"ep-{ep_date}-{index + 1:02d}",
        "index": index,
        "type": "session",
        "timestamp": ep.get("date") or "Today",
        "projectSlug": ep.get("projectSlug"),
        "topic": ep.get("topic"),
        "summary": (
            f"{ep.get('projectSlug', 'OS')}: {ep.get('topic', 'Session')} "
            f"(Phase {ep.get('phaseReached', 1)}, {ep.get('status', 'em-andamento')}) "
            f"— {ep.get('extracted', '')}"
        ),
        "source": "workspace/_meta/EPISODES.jsonl",
        "rawRef": ep.get("extracted"),
    }


def get_full_memory_graph() -> dict:
    evidences = read_evidences()
    l1_traces = [_episode_to_trace(i, ep) for i, ep in enumerate(read_episodes())]

    verified_caps = 0
    caps_with_evidence = 0
    l3_arcs = []
    for arc in read_arcs_data():
        cap_rows = []
        for cap in arc.get("capabilities", []):
            matched = _evidence_for(arc["id"], cap, evidences)
            if cap.get("verified"):
                verified_caps += 1
                caps_with_evidence += bool(matched)
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
            "verifiedCapabilities": verified_caps,
            "auditHealthScore": (
                round(caps_with_evidence / verified_caps * 100) if verified_caps else 100
            ),
        },
    }


def link_capability(capability_id: str, claim: str, evidence_id: str) -> None:
    """Marks the capability verified in ARCS.json and points it at the new evidence."""
    arcs = read_arcs_data()
    for arc in arcs:
        cap = next((c for c in arc["capabilities"] if c["id"] == capability_id), None)
        if cap:
            cap["verified"] = True
            cap["evidence"] = claim
            cap["evidenceIds"] = sorted(set(cap.get("evidenceIds") or []) | {evidence_id})
            cap["verifiedAt"] = datetime.now(UTC).isoformat()
            save_arcs_data(arcs)
            return


def unlink_evidence(evidence_id: str) -> None:
    """Removes evidence_id from all capabilities in ARCS.json, updating verified status."""
    arcs = read_arcs_data()
    changed = False
    for arc in arcs:
        for cap in arc.get("capabilities", []):
            ev_ids = cap.get("evidenceIds") or []
            if evidence_id in ev_ids:
                changed = True
                ev_ids = [eid for eid in ev_ids if eid != evidence_id]
                cap["evidenceIds"] = ev_ids
                if not ev_ids:
                    cap["verified"] = False
                    cap["evidence"] = ""
                    cap["verifiedAt"] = None
    if changed:
        save_arcs_data(arcs)


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
    today = date.today().isoformat().replace("-", "")
    ev_id = f"ev-{today}-{short_id()}"
    source_l1_id = source_l1_id or f"ep-{today}-01"

    evidences = read_evidences()
    evidences.append({
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
    })
    write_evidences(evidences)

    if capability_id:
        link_capability(capability_id, claim, ev_id)

    return {
        "ok": True,
        "evidenceId": ev_id,
        "totalEvidences": len(evidences),
        "auditChain": f"L3 ({arc_id or 'Meta'}) ➔ L2 ({ev_id}) ➔ L1 ({source_l1_id})",
    }


def evidence_list(
    arc_id: str | None = None, surface: str | None = None, search: str | None = None
) -> dict:
    """Lists and searches the collection of auditable L2 facts and evidence backing the profile's capabilities.

    Args:
        arc_id: Only return evidence linked to this Capability Arc.
        surface: Only return evidence from this surface (benchmark, code_review, ...).
        search: Keyword to match against the claim and metric.
    """
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
