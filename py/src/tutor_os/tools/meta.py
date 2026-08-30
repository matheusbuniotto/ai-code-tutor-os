"""Port of src/mastra/tools/meta.ts."""

from __future__ import annotations

import json
import re
from datetime import date

from tutor_os.storage import WORKSPACE_ROOT
from tutor_os.tools.arcs import read_arcs_data

META_DIR = WORKSPACE_ROOT / "_meta"
NOW_PATH = META_DIR / "NOW.md"
OBS_PATH = META_DIR / "OBSERVATIONS.json"
EXP_PATH = META_DIR / "EXPERIMENTS.json"


def _empty_now_content() -> str:
    return f"""# NOW — Foco Ativo

**Projeto:** vazio
**Missão:** (sem missão ativa)
**Fase:** 1/4
**Data:** {date.today().isoformat()}

## Objetivo Observável
Sem projeto ativo no momento

## Próxima Ação (< 2min)
Definir nova missão quando houver demanda
"""


def _extract_now_project_slug(now_content: str) -> str | None:
    m = re.search(r"\*\*Projeto:\*\*\s*(\S+)", now_content)
    return m.group(1) if m else None


def clear_now_if_active_project(slug: str) -> None:
    """Called by workspace-delete / workspace-archive.

    If the removed/archived project is the one active in NOW.md, clears the
    focus instead of leaving a dead reference.
    """
    if not NOW_PATH.exists():
        return
    content = NOW_PATH.read_text(encoding="utf-8")
    if _extract_now_project_slug(content) == slug:
        NOW_PATH.write_text(_empty_now_content(), encoding="utf-8")


def meta_overview() -> dict:
    """Retorna o panorama completo de Meta-Learning: NOW.md, Arcos, Projetos e Tiny Experiments/observações."""
    now_content = NOW_PATH.read_text(encoding="utf-8") if NOW_PATH.exists() else ""

    arcs = read_arcs_data()
    total_capabilities = 0
    verified_capabilities = 0
    pending_capabilities: list[dict] = []
    for a in arcs:
        for c in a.get("capabilities", []):
            total_capabilities += 1
            if c.get("verified"):
                verified_capabilities += 1
            else:
                pending_capabilities.append(
                    {"arcId": a["id"], "capId": c["id"], "title": c["title"]}
                )

    projects: list[dict] = []
    if WORKSPACE_ROOT.exists():
        for entry in sorted(WORKSPACE_ROOT.iterdir()):
            if (
                not entry.is_dir()
                or entry.name.startswith(".")
                or entry.name.startswith("_")
            ):
                continue
            title = entry.name
            phase = 1
            status = "in_progress"

            spec_path = entry / "SPEC.md"
            if spec_path.exists():
                spec_text = spec_path.read_text(encoding="utf-8")
                m = re.search(
                    r"^#\s*SPEC\s*—\s*(?:Projeto\s*\S+\s*\(([^)]+)\)|([^\n]+))",
                    spec_text,
                    re.MULTILINE,
                )
                if m:
                    title = (m.group(1) or m.group(2) or entry.name).strip()

            state_path = entry / "STATE.md"
            if state_path.exists():
                state_text = state_path.read_text(encoding="utf-8")
                phm = re.search(r"fase:\s*(\d+)", state_text, re.IGNORECASE)
                if phm:
                    phase = int(phm.group(1))
                stm = re.search(r"status:\s*([^\n]+)", state_text, re.IGNORECASE)
                if stm:
                    status = stm.group(1).strip()

            has_assignment = (entry / "ASSIGNMENT.md").exists()
            projects.append(
                {
                    "slug": entry.name,
                    "title": title,
                    "phase": phase,
                    "status": status,
                    "hasAssignment": has_assignment,
                }
            )

    experiments_count = 0
    if EXP_PATH.exists():
        try:
            exps = json.loads(EXP_PATH.read_text(encoding="utf-8"))
            experiments_count = (
                len(exps)
                if isinstance(exps, list)
                else len(exps.get("experiments", []))
            )
        except Exception:  # noqa: BLE001
            pass

    observations_count = 0
    if OBS_PATH.exists():
        try:
            obs = json.loads(OBS_PATH.read_text(encoding="utf-8"))
            observations_count = (
                len(obs) if isinstance(obs, list) else len(obs.get("observations", []))
            )
        except Exception:  # noqa: BLE001
            pass

    now_slug = _extract_now_project_slug(now_content)
    now_stale = bool(
        now_slug
        and now_slug != "vazio"
        and not any(p["slug"] == now_slug for p in projects)
    )

    return {
        "now": now_content,
        "arcsSummary": {
            "totalArcs": len(arcs),
            "totalCapabilities": total_capabilities,
            "verifiedCapabilities": verified_capabilities,
            "pendingCapabilities": pending_capabilities[:8],
        },
        "projects": projects,
        "experimentsCount": experiments_count,
        "observationsCount": observations_count,
        "nowStale": now_stale,
    }


def meta_set_now(
    project_slug: str, mission: str, objective: str, next_action: str, phase: int = 1
) -> dict:
    """Atualiza o arquivo NOW.md (foco ativo) com projeto ativo, missão, objetivo e próxima ação <2min.

    Args:
        project_slug: Slug do projeto ativo no workspace.
        mission: Título da missão ativa.
        objective: Objetivo observável / critério de sucesso.
        next_action: Próxima micro-ação física <2min.
        phase: Fase atual (1 a 4).
    """
    content = f"""# NOW — Foco Ativo

**Projeto:** {project_slug}
**Missão:** {mission}
**Fase:** {phase}/4
**Data:** {date.today().isoformat()}

## Objetivo Observável
{objective}

## Próxima Ação (< 2min)
{next_action}
"""
    NOW_PATH.parent.mkdir(parents=True, exist_ok=True)
    NOW_PATH.write_text(content, encoding="utf-8")
    return {"ok": True, "content": content}
