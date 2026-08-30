"""Port of src/mastra/tools/workspace.ts."""

from __future__ import annotations

import re
import shutil
from datetime import date
from pathlib import Path

from tutor_os.storage import WORKSPACE_ROOT
from tutor_os.tools.meta import clear_now_if_active_project

_PROJECT_TEMPLATE_DIRS = ["01-topology", "02-tracer-bullet", "03-break-edges", "cards"]
_SLUG_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def _check_slug(slug: str) -> None:
    if not slug or not _SLUG_RE.match(slug):
        raise ValueError("slug: letras, números, hífen e underscore")


def _project_dir(slug: str) -> Path:
    return WORKSPACE_ROOT / slug


def _safe_path(slug: str, rel_path: str) -> Path:
    """Guarda contra path traversal: o path resolvido precisa ficar estritamente dentro do projeto."""
    base = _project_dir(slug).resolve()
    full = (base / rel_path).resolve()
    if full != base and base not in full.parents:
        raise ValueError(f'Caminho fora dos limites do projeto "{slug}": {rel_path}')
    return full


def _safe_workspace_path(rel_path: str) -> Path:
    base = WORKSPACE_ROOT.resolve()
    full = (base / rel_path).resolve()
    if full != base and base not in full.parents:
        raise ValueError(f"Caminho fora dos limites do workspace: {rel_path}")
    return full


def _spec_template(title: str, objective: str, stack: str) -> str:
    return f"""# SPEC — {title}

**Stack:** {stack}
**Objetivo:** {objective}
**Fase atual:** 1/4 (macro-topologia)

---

## [PORQUÊ]
<!-- 2-3 linhas: onde se encaixa na arquitetura + quem chama + caso de falha -->

## [CONCEITO NOVO]
<!-- UM conceito. Analogia mundana antes do código + artefato mínimo isolado -->

## [ANTES/DEPOIS]
<!-- versão ingênua → versão moderna + 1 linha do que mudou e por quê -->

## [VOCÊ ESCREVE]
<!-- o que você implementa (scaffolding calibrado ao nível) -->

## [EU FAÇO]
<!-- o que o tutor executa (boilerplate, setup, integração sem conceito novo) -->

## [CRITÉRIO]
"Pronto quando: ..."

## [HUMAN GATE]
<!-- comando exato que você roda para validar -->
"""


def _state_template() -> str:
    return f"""# STATE

fase: 1
status: em-andamento
ultima_sessao: {date.today().isoformat()}

## Log de fases
- fase:1 iniciada
"""


def _list_files_recursive(dir_path: Path, base_dir: Path | None = None) -> list[str]:
    base_dir = base_dir or dir_path
    if not dir_path.exists():
        return []
    files: list[str] = []
    for entry in sorted(dir_path.iterdir()):
        rel = str(entry.relative_to(base_dir))
        if entry.is_dir():
            files.append(rel)
            files.extend(_list_files_recursive(entry, base_dir))
        else:
            files.append(rel)
    return files


def workspace_init(project_slug: str, title: str, objective: str, stack: str) -> dict:
    """Cria a estrutura de pastas de um novo projeto de aprendizado dentro de workspace/.

    Chame ANTES de qualquer escrita de artefato. Retorna os caminhos criados.

    Args:
        project_slug: ex: sysdesign-mod01-latency.
        title: Título do projeto (min. 3 chars).
        objective: Objetivo do projeto (min. 10 chars).
        stack: Stack tecnológica.
    """
    _check_slug(project_slug)
    dir_path = _project_dir(project_slug)
    dir_path.mkdir(parents=True, exist_ok=True)

    created: list[str] = []
    for sub in _PROJECT_TEMPLATE_DIRS:
        p = dir_path / sub
        if not p.exists():
            p.mkdir()
        created.append(sub)

    spec_path = dir_path / "SPEC.md"
    if not spec_path.exists():
        spec_path.write_text(_spec_template(title, objective, stack), encoding="utf-8")
        created.append("SPEC.md")

    state_path = dir_path / "STATE.md"
    if not state_path.exists():
        state_path.write_text(_state_template(), encoding="utf-8")
        created.append("STATE.md")

    return {
        "created": created,
        "specPath": str(spec_path),
        "statePath": str(state_path),
    }


def workspace_write(project_slug: str, path: str, content: str) -> dict:
    """Escreve um artefato dentro da pasta do projeto ativo.

    Caminho relativo ao projeto; não pode sair da pasta.

    Args:
        project_slug: slug do projeto.
        path: relativo à pasta do projeto, ex: 01-topology/mapa.md.
        content: conteúdo do arquivo.
    """
    full = _safe_path(project_slug, path)
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(content, encoding="utf-8")
    return {"ok": True, "fullPath": str(full)}


def workspace_read(project_slug: str, path: str, is_archived: bool = False) -> dict:
    """Lê um artefato do projeto ativo ou arquivado."""
    full = (
        (WORKSPACE_ROOT / "_archive" / project_slug / path)
        if is_archived
        else _safe_path(project_slug, path)
    )
    content = (
        full.read_text(encoding="utf-8")
        if full.exists()
        else f"(arquivo não existe: {path})"
    )
    return {"content": content}


def workspace_delete(
    project_slug: str | None = None, path: str | None = None, is_archived: bool = False
) -> dict:
    """Deleta com segurança um arquivo de artefato ou um projeto inteiro dentro de workspace/ ou workspace/_archive/."""
    if is_archived:
        base = WORKSPACE_ROOT / "_archive" / (project_slug or "")
        target = (base / path) if path else base
    elif project_slug:
        target = (
            _safe_path(project_slug, path)
            if path
            else _safe_workspace_path(project_slug)
        )
    elif path:
        target = _safe_workspace_path(path)
    else:
        raise ValueError("Especifique um projeto ou arquivo para deletar")

    if target.exists():
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()

    if not is_archived and project_slug and not path:
        clear_now_if_active_project(project_slug)

    return {"ok": True, "deletedPath": str(target)}


def workspace_archive(project_slug: str, action: str = "archive") -> dict:
    """Arquiva/conclui ou restaura um projeto movendo-o entre workspace/ e workspace/_archive/.

    Args:
        project_slug: slug do projeto (min. 1 char).
        action: archive | restore.
    """
    archive_root = WORKSPACE_ROOT / "_archive"
    archive_root.mkdir(parents=True, exist_ok=True)

    src_dir = (
        _safe_workspace_path(project_slug)
        if action == "archive"
        else archive_root / project_slug
    )
    dest_dir = (
        (archive_root / project_slug)
        if action == "archive"
        else _safe_workspace_path(project_slug)
    )

    if not src_dir.exists():
        raise ValueError(f"Diretório de origem não encontrado: {src_dir}")

    if dest_dir.exists():
        shutil.rmtree(dest_dir)

    if action == "archive":
        state_path = src_dir / "STATE.md"
        if state_path.exists():
            try:
                content = state_path.read_text(encoding="utf-8")
                content = re.sub(
                    r"^status: .*$", "status: concluido", content, flags=re.MULTILINE
                )
                content += f"\n- arquivado em {date.today().isoformat()}\n"
                state_path.write_text(content, encoding="utf-8")
            except Exception:  # noqa: BLE001
                pass

    shutil.move(str(src_dir), str(dest_dir))

    if action == "archive":
        clear_now_if_active_project(project_slug)

    verb = "arquivado como concluído" if action == "archive" else "restaurado"
    return {"ok": True, "message": f"Projeto {project_slug} {verb} com sucesso."}


def workspace_list() -> dict:
    """Lista projetos ativos e arquivados em workspace/ e todos os seus arquivos recursivamente."""
    if not WORKSPACE_ROOT.exists():
        return {"projects": [], "archivedProjects": []}

    projects: list[dict] = []
    archived_projects: list[dict] = []

    for entry in sorted(WORKSPACE_ROOT.iterdir()):
        if not entry.is_dir() or entry.name.startswith("."):
            continue
        if entry.name == "_archive":
            for archived_entry in sorted(entry.iterdir()):
                if not archived_entry.is_dir() or archived_entry.name.startswith("."):
                    continue
                archived_projects.append(
                    {
                        "slug": archived_entry.name,
                        "files": _list_files_recursive(archived_entry),
                    }
                )
            continue
        if entry.name.startswith("_"):
            continue
        projects.append({"slug": entry.name, "files": _list_files_recursive(entry)})

    return {"projects": projects, "archivedProjects": archived_projects}


def phase_set(
    project_slug: str, phase: int, status: str, note: str | None = None
) -> dict:
    """Atualiza a fase (1-4) e status no STATE.md do projeto.

    Fases: 1=macro-topologia, 2=tracer-bullet, 3=break-edges, 4=nota-arquitetura.

    Args:
        project_slug: slug do projeto.
        phase: 1 a 4.
        status: em-andamento | concluido | pausado.
        note: nota opcional de log.
    """
    state_path = _safe_path(project_slug, "STATE.md")
    body = (
        state_path.read_text(encoding="utf-8")
        if state_path.exists()
        else _state_template()
    )
    body = re.sub(r"^fase: .*$", f"fase: {phase}", body, flags=re.MULTILINE)
    body = re.sub(r"^status: .*$", f"status: {status}", body, flags=re.MULTILINE)
    body = re.sub(
        r"^ultima_sessao: .*$",
        f"ultima_sessao: {date.today().isoformat()}",
        body,
        flags=re.MULTILINE,
    )
    if note:
        body += f"- fase:{phase} — {note}\n"
    state_path.write_text(body, encoding="utf-8")
    return {"ok": True}
