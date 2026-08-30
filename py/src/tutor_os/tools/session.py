"""Port of src/mastra/workflows/session.ts.

Deterministic phase-tracking state machine for the 4 phases of the Inverted
Pyramid, with human-in-the-loop gates. No Mastra Workflow-with-suspend
primitive exists in pydantic-ai, so this is a small stateless state machine
built directly on `workspace_init`/`phase_set` (`tools/workspace.py`), which
already persist the exact same SPEC.md/STATE.md shape TS's `ensureProject`/
`writePhase` do — no new persistence mechanism needed, just the sequencing
logic TS got from Mastra's step runtime.
"""

from __future__ import annotations

from typing import TypedDict

from tutor_os.tools.workspace import phase_set, workspace_init


class Phase(TypedDict):
    n: int
    id: str
    dir: str
    kickoff: str
    artifact: str


PHASES: tuple[Phase, ...] = (
    {
        "n": 1,
        "id": "macro-topologia",
        "dir": "01-topology",
        "kickoff": "Mapear invariantes/trade-offs no PAPEL antes de abrir o editor.",
        "artifact": "01-topology/mapa.md",
    },
    {
        "n": 2,
        "id": "tracer-bullet",
        "dir": "02-tracer-bullet",
        "kickoff": (
            "Menor protótipo ponta-a-ponta tocando os primitivos centrais. "
            "Você escreve; scaffolder entrega esqueleto com lacunas."
        ),
        "artifact": "02-tracer-bullet/",
    },
    {
        "n": 3,
        "id": "break-edges",
        "dir": "03-break-edges",
        "kickoff": (
            "Quebrar o protótipo nos limites (concorrência, dado malformado, "
            "escala) para fixar intuição física."
        ),
        "artifact": "03-break-edges/",
    },
    {
        "n": 4,
        "id": "nota-arquitetura",
        "dir": ".",
        "kickoff": (
            "1 página: invariantes / quando usar vs não usar / armadilhas. "
            "Harvester fecha a sessão depois disso."
        ),
        "artifact": "04-arquitetura-note.md",
    },
)

_PHASES_BY_N: dict[int, Phase] = {p["n"]: p for p in PHASES}
_FINAL_PHASE = 4


def _suspended_response(
    project_slug: str, phase: Phase, completed_phase: int | None = None
) -> dict:
    response = {
        "projectSlug": project_slug,
        "suspended": True,
        "finished": False,
        "phase": phase["n"],
        "phaseId": phase["id"],
        "kickoff": phase["kickoff"],
        "expectedArtifact": phase["artifact"],
        "message": (
            f"Fase {phase['n']}/4 — {phase['id']}. {phase['kickoff']} "
            "Confirme o gate quando o critério estiver verde."
        ),
    }
    if completed_phase is not None:
        response["completedPhase"] = completed_phase
    return response


def session_start(project_slug: str, title: str, objective: str, stack: str) -> dict:
    """Inicia (ou retoma) uma sessão da Pirâmide Invertida para um projeto.

    Garante a estrutura de pastas/SPEC.md/STATE.md via `workspace_init`
    (idempotente — reusa arquivos existentes em vez de sobrescrever) e
    retorna o gate suspenso da fase 1: toda sessão nova começa suspensa
    aguardando o critério da fase 1 ficar verde.

    Args:
        project_slug: slug do projeto.
        title: Título do projeto.
        objective: Objetivo do projeto.
        stack: Stack tecnológica.
    """
    workspace_init(project_slug, title, objective, stack)
    return _suspended_response(project_slug, _PHASES_BY_N[1])


def session_advance(project_slug: str, phase: int, passed: bool, note: str | None = None) -> dict:
    """Avança (ou reafirma) o gate humano de uma fase da sessão.

    Se `passed` for False, retorna de novo o gate suspenso da fase atual sem
    alterar o STATE.md — mesma semântica do `suspend()` do Mastra, que só
    interrompe a execução e não persiste nada.

    Se `passed` for True, marca a fase como concluída e:
    - se `phase` < 4: retorna imediatamente o gate suspenso da PRÓXIMA fase
      (equivalente ao encadeamento `.then(phaseNStep)` do Mastra: o resume
      de uma fase entra direto na execução do próximo step, que suspende de
      novo por ainda não ter `resumeData`).
    - se `phase` == 4: fecha a sessão — replica o comportamento do
      `finishStep` do TS, que roda incondicionalmente após o gate da fase 4
      e REESCREVE o status de "concluido" de volta para "em-andamento" com
      uma nota de encerramento, sinalizando que as 4 fases de código estão
      prontas mas a sessão só fecha de verdade depois que o Harvester rodar.

    Args:
        project_slug: slug do projeto.
        phase: fase sendo confirmada (1 a 4).
        passed: se o critério "pronto quando" da fase está satisfeito.
        note: nota opcional do gate (registrada no log do STATE.md).
    """
    if phase not in _PHASES_BY_N:
        raise ValueError("phase precisa ser 1, 2, 3 ou 4")

    if not passed:
        return _suspended_response(project_slug, _PHASES_BY_N[phase])

    if phase < _FINAL_PHASE:
        phase_set(project_slug, phase, "concluido", note)
        return _suspended_response(project_slug, _PHASES_BY_N[phase + 1], completed_phase=phase)

    phase_set(project_slug, _FINAL_PHASE, "concluido", note)
    phase_set(project_slug, _FINAL_PHASE, "em-andamento", "sessão encerrada — rodar harvest")
    return {
        "projectSlug": project_slug,
        "suspended": False,
        "finished": True,
        "completedPhase": _FINAL_PHASE,
        "summary": f"Projeto {project_slug}: 4 fases concluídas. Chame o Harvester.",
    }
