"""Port of src/mastra/tools/assignment.ts."""

from __future__ import annotations

from tutor_os.storage import WORKSPACE_ROOT
from tutor_os.tools.arcs import read_arcs_data


def assignment_generate(
    project_slug: str,
    title: str,
    arc_id: str,
    targeted_gap: str,
    predict_phase: str,
    implementation_instrument: str,
    measure_phase: str,
    mutate_phase: str,
    explain_phase: str,
) -> dict:
    """Gera um desafio de engenharia estruturado (Assignment Engine).

    Calibrado para expor lacunas de julgamento técnico. Segue o protocolo:
    Prever ➔ Medir ➔ Mutar ➔ Explicar trade-offs.

    Args:
        project_slug: Slug do projeto ativo.
        title: Título do desafio de engenharia.
        arc_id: ID do arco de capacidade correspondente (customizável via ARCS.json).
        targeted_gap: Lacuna de capacidade específica a ser exercitada.
        predict_phase: Perguntas de predição antes de rodar.
        implementation_instrument: Código ou instrumento de teste mínimo para executar.
        measure_phase: Comando exato de medição e métricas a coletar.
        mutate_phase: Variações de parâmetro para estressar o sistema.
        explain_phase: Perguntas de julgamento e defesa de arquitetura.
    """
    project_dir = WORKSPACE_ROOT / project_slug
    project_dir.mkdir(parents=True, exist_ok=True)

    arcs = read_arcs_data()
    found_arc = next((a for a in arcs if a["id"] == arc_id), None)
    arc_title = found_arc["title"] if found_arc else f"Arco: {arc_id}"

    markdown = f"""# Engineering Assignment: {title}
**Arco:** {arc_title}
**Lacuna Alvo:** {targeted_gap}
**Princípio:** *A implementação é apenas o instrumento. Seu julgamento de engenharia é o desafio.*

---

## 1. Fase de Predição (Antes de Rodar)
> *Formule suas hipóteses antes de olhar qualquer gráfico ou benchmark.*

{predict_phase}

---

## 2. Instrumento de Execução
```
{implementation_instrument}
```

---

## 3. Fase de Medição (Evidência Empírica)
> *Execute os comandos de teste e registre os números reais.*

{measure_phase}

---

## 4. Fase de Mutação (Escalar e Estressar)
> *Varie os parâmetros para encontrar o ponto de inflexão e colapso.*

{mutate_phase}

---

## 5. Fase de Explicação & Julgamento (Defesa)
> *Explique a física do sistema com base nos trade-offs observados.*

{explain_phase}
"""

    file_path = project_dir / "ASSIGNMENT.md"
    file_path.write_text(markdown, encoding="utf-8")

    return {"ok": True, "filePath": str(file_path), "markdown": markdown}


def assignment_read(project_slug: str) -> dict:
    """Lê o arquivo ASSIGNMENT.md do projeto ativo para revisão ou continuação do desafio."""
    file_path = WORKSPACE_ROOT / project_slug / "ASSIGNMENT.md"
    if not file_path.exists():
        return {"exists": False, "content": "Nenhum ASSIGNMENT.md ativo neste projeto."}
    return {"exists": True, "content": file_path.read_text(encoding="utf-8")}
