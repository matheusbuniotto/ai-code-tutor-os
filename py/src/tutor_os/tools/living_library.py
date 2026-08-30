"""Port of src/mastra/tools/living-library.ts.

Living Architecture Library: catalogs and synthesizes the 1-page architecture
notes (Phase 4 of the Inverted Pyramid). Converts learning into permanent
public/professional assets.
"""

from __future__ import annotations

from tutor_os.storage import WORKSPACE_ROOT

LIBRARY_INDEX_PATH = WORKSPACE_ROOT / "_meta" / "LIBRARY.md"


def _rebuild_library_index() -> dict:
    if not WORKSPACE_ROOT.exists():
        return {"totalNotes": 0, "notes": []}

    notes: list[dict] = []
    for entry in sorted(WORKSPACE_ROOT.iterdir()):
        if not entry.is_dir() or entry.name.startswith("_"):
            continue
        note_path = entry / "04-arquitetura-note.md"
        if note_path.exists():
            content = note_path.read_text(encoding="utf-8")
            title = entry.name
            for line in content.splitlines():
                if line.startswith("# "):
                    title = line[2:].strip()
                    break
            notes.append(
                {
                    "projectSlug": entry.name,
                    "title": title,
                    "path": f"{entry.name}/04-arquitetura-note.md",
                    "snippet": content[:300].replace("\n", " "),
                }
            )

    markdown_index = "# Living Architecture Library\n\n*Coleção permanente de notas de arquitetura e invariantes de sistemas (Fase 4 — Pirâmide Invertida).*\n\n"
    if not notes:
        markdown_index += "*(Nenhuma nota de arquitetura consolidada ainda. Complete a Fase 4 de um projeto para indexar aqui.)*\n"
    else:
        markdown_index += "| Projeto | Título | Caminho |\n|---|---|---|\n"
        for n in notes:
            markdown_index += f"| `{n['projectSlug']}` | **{n['title']}** | [{n['path']}](../{n['path']}) |\n"

    LIBRARY_INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    LIBRARY_INDEX_PATH.write_text(markdown_index, encoding="utf-8")

    return {"totalNotes": len(notes), "notes": notes}


def library_index() -> dict:
    """Lista e indexa todas as Notas de Arquitetura de 1 página criadas na Fase 4 dos projetos.

    Retorna os ativos catalogados na Living Architecture Library com seus invariantes e trade-offs.
    """
    return _rebuild_library_index()


def library_save_note(
    project_slug: str,
    title: str,
    invariants: str,
    when_to_use: str,
    when_not_to_use: str,
    hidden_traps: str,
    proof_artifact: str,
) -> dict:
    """Salva uma Nota de Arquitetura de 1 página (Fase 4 da Pirâmide Invertida).

    Exige formato estrito: Invariantes Centrais | Quando Usar vs Não Usar | Armadilhas e Falhas.

    Args:
        project_slug: Slug do projeto (minúsculo, hífens).
        title: Título da nota.
        invariants: Invariantes fundamentais e modelo de dados/execução.
        when_to_use: Cenários ideais de aplicação.
        when_not_to_use: Cenários de contra-indicação ou overkill.
        hidden_traps: Armadilhas, limites de escala, falhas de concorrência ou custos ocultos.
        proof_artifact: Comando ou teste que comprova a intuição física obtida.
    """
    project_dir = WORKSPACE_ROOT / project_slug
    project_dir.mkdir(parents=True, exist_ok=True)

    from datetime import date

    note_content = f"""# Nota de Arquitetura: {title}
*Fase 4 — Síntese da Pirâmide Invertida | Data: {date.today().isoformat()}*

---

## 1. Invariantes Centrais (First Principles)
{invariants}

---

## 2. Quando Usar vs. Quando NÃO Usar
### ✅ Quando Usar
{when_to_use}

### ❌ Quando NÃO Usar (Contra-indicações)
{when_not_to_use}

---

## 3. Armadilhas Ocultas & Limites Físicos (Break Edges Findings)
{hidden_traps}

---

## 4. Artefato de Comprovação
```bash
{proof_artifact}
```
"""

    note_path = project_dir / "04-arquitetura-note.md"
    note_path.write_text(note_content, encoding="utf-8")

    _rebuild_library_index()

    return {"ok": True, "filePath": f"{project_slug}/04-arquitetura-note.md"}
