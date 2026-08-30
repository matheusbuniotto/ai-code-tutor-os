"""Port of src/mastra/tools/observations.ts."""

from __future__ import annotations

import json
from typing import TypedDict

from tutor_os.config.learner_profile import learner_profile
from tutor_os.storage import WORKSPACE_ROOT

OBSERVATIONS_PATH = WORKSPACE_ROOT / "_meta" / "OBSERVATIONS.json"


class Observation(TypedDict):
    tag: str
    text: str


def get_default_observations() -> list[Observation]:
    base: list[Observation] = [
        {
            "tag": "Architecture Method",
            "text": "Pirâmide Invertida: 1. Topologia Macro → 2. Tracer Bullet → 3. Break Edges → 4. Nota 1-Página.",
        },
        {
            "tag": "Cognitive Invariant",
            "text": "Paper-First: Desenho topológico e análise de trade-offs antes de codar.",
        },
    ]
    if learner_profile.has_neuropsych_rescue_profile:
        tag_suffix = (
            f" • {learner_profile.cognitive_tag}"
            if learner_profile.cognitive_tag
            else ""
        )
        base.insert(
            0,
            {
                "tag": "Profile Calibration",
                "text": f"{learner_profile.name}{tag_suffix}",
            },
        )
    return base


def read_observations() -> list[Observation]:
    try:
        if OBSERVATIONS_PATH.exists():
            return json.loads(OBSERVATIONS_PATH.read_text(encoding="utf-8"))
    except Exception as err:  # noqa: BLE001
        print(f"Erro ao ler OBSERVATIONS.json: {err}")
    return get_default_observations()


def write_observations(observations: list[Observation]) -> None:
    OBSERVATIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    OBSERVATIONS_PATH.write_text(
        json.dumps(observations, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def observation_capture(tag: str, text: str) -> dict:
    """Registra uma observação curta e duradoura sobre o aprendiz ou o projeto assim que ela for percebida.

    Não espere o fechamento de sessão nem peça permissão. Use para fatos concretos
    (decisão tomada, preferência expressa, mudança de direção de projeto, padrão de
    bloqueio observado, capacidade demonstrada). NÃO use para opiniões, hipóteses não
    confirmadas, ou repetições do que já foi registrado — prefira poucas observações
    de alta qualidade a muitas triviais.

    Args:
        tag: categoria curta, ex: 'Decisão de Arquitetura', 'Preferência', 'Padrão de Bloqueio'.
        text: a observação em 1-2 frases, factual e específica.
    """
    observations = read_observations()
    observations.append({"tag": tag, "text": text})
    write_observations(observations)
    return {"ok": True, "totalObservations": len(observations)}
