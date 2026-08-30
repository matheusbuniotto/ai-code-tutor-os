"""Port of src/mastra/tools/gate.ts.

3-Gate Leverage Filter: evaluates ideas/demands before starting execution.
Protects focus and avoids dopaminergic collapse / dispersion.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Literal

from tutor_os.storage import WORKSPACE_ROOT

GATE_HISTORY_PATH = WORKSPACE_ROOT / "_meta" / "GATE_HISTORY.jsonl"

Context = Literal["trabalho", "estudo_pessoal"]
Verdict = Literal["GO", "DELEGATE_AUTOMATE_ASYNC", "POSTPONE_RECORD"]


def gate_check(
    context: Context,
    topic: str,
    work_high_abstraction: bool = False,
    work_squad_multiplier: bool = False,
    work_career_moat: bool = False,
    personal_cluster_deepening: bool = False,
    personal_tracer_bullet_fit: bool = False,
    personal_topology_before_syntax: bool = False,
    personal_demand_and_no_abandon_trap: bool = False,
    impostor_doubt_expressed: str | None = None,
) -> dict:
    """Executa o Filtro de Portões (3-Gate Leverage Filter) para Trabalho ou Estudo/Projeto Pessoal.

    Retorna o veredito estruturado (GO, DELEGATE_AUTOMATE_ASYNC, POSTPONE_RECORD),
    justificativas e âncora anti-impostor baseada em evidências concretas quando aplicável.

    Args:
        context: Contexto da demanda: trabalho corporativo (Tech Lead) ou estudo/lab pessoal.
        topic: Tema ou ideia a ser avaliada.
        work_high_abstraction: Trabalho Portão 1: arquitetura de IA, schema de dados, confiabilidade ou avaliação?
        work_squad_multiplier: Trabalho Portão 2: vira playbook, template reutilizável ou guardrail de CI/CD?
        work_career_moat: Trabalho Portão 3: gera ativo público (case study/RFC) com demanda 2027-2030?
        personal_cluster_deepening: Estudo Portão 1: aprofunda cluster/projeto existente (não é novidade do zero)?
        personal_tracer_bullet_fit: Estudo Portão 2: cabe em um tracer bullet ponta-a-ponta em uma sessão focada?
        personal_topology_before_syntax: Estudo Portão 3: primeiro passo é mapear invariantes no papel?
        personal_demand_and_no_abandon_trap: Estudo Portão 4: demanda alta/estável 2027-2030 e sem histórico de abandono similar?
        impostor_doubt_expressed: Dúvida de competência expressada pelo usuário, se houver.
    """
    gates_summary: dict[str, bool] = {}

    if context == "trabalho":
        gates_summary["1_arquitetura_alto_nivel"] = work_high_abstraction
        gates_summary["2_multiplicador_squad"] = work_squad_multiplier
        gates_summary["3_ativo_carreira_2027_2030"] = work_career_moat

        if work_high_abstraction or work_squad_multiplier or work_career_moat:
            verdict: Verdict = "GO"
            rationale = (
                "Passou em pelo menos 1 portão de trabalho de alto valor agregado."
            )
        else:
            verdict = "DELEGATE_AUTOMATE_ASYNC"
            rationale = "Não passou nos portões de alta alavancagem. Delegar, automatizar ou tratar assincronamente."
    else:
        gates_summary["1_aprofundamento_cluster"] = personal_cluster_deepening
        gates_summary["2_cabe_tracer_bullet"] = personal_tracer_bullet_fit
        gates_summary["3_topologia_antes_sintaxe"] = personal_topology_before_syntax
        gates_summary["4_demanda_futura_sem_abandono"] = (
            personal_demand_and_no_abandon_trap
        )

        passed_count = sum(
            [
                personal_cluster_deepening,
                personal_tracer_bullet_fit,
                personal_topology_before_syntax,
                personal_demand_and_no_abandon_trap,
            ]
        )
        if passed_count >= 3:
            verdict = "GO"
            rationale = f"Passou em {passed_count}/4 portões do lab pessoal. Aprovado para execução na Pirâmide Invertida."
        else:
            verdict = "POSTPONE_RECORD"
            rationale = f"Passou em apenas {passed_count}/4 portões. Anotar no INBOX/ideias e adiar para proteger foco."

    anti_impostor_anchor = None
    if impostor_doubt_expressed:
        anti_impostor_anchor = (
            "Âncora de realidade: Seu perfil cognitivo aprende invariantes mais rápido que a média. "
            "Sua vantagem assimétrica é a síntese entre arquitetura de IA, dados e ROI de negócio, não o acúmulo de sintaxe isolada."
        )

    try:
        GATE_HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "topic": topic,
            "context": context,
            "verdict": verdict,
            "gatesSummary": gates_summary,
            "rationale": rationale,
        }
        with GATE_HISTORY_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:  # noqa: BLE001 - non-blocking write, mirrors the TS swallow
        pass

    return {
        "topic": topic,
        "context": context,
        "verdict": verdict,
        "gatesSummary": gates_summary,
        "rationale": rationale,
        "antiImpostorAnchor": anti_impostor_anchor,
        "recorded": True,
    }
