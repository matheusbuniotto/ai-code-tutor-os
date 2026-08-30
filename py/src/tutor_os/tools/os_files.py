"""Port of src/mastra/tools/os-files.ts.

OS-level workspace files (outside projects): NOW.md, INBOX.md, sessions/,
reviews/. Templates in _templates/ are read-only here.
"""

from __future__ import annotations

from pathlib import Path

from tutor_os.storage import WORKSPACE_ROOT

_FORBIDDEN_WRITE = {"_templates", "_meta"}


def _safe_os_path(rel_path: str, for_write: bool = False) -> Path:
    base = WORKSPACE_ROOT.resolve()
    full = (base / rel_path).resolve()
    if full != base and base not in full.parents:
        raise ValueError(f"Caminho fora do workspace: {rel_path}")
    if for_write:
        top = full.relative_to(base).parts[0] if full != base else ""
        if top in _FORBIDDEN_WRITE:
            raise ValueError(f"Diretório protegido para escrita: {top}")
    return full


def os_write(path: str, content: str) -> dict:
    """Escreve arquivo no nível do OS do workspace (fora de projetos).

    NOW.md, INBOX.md, sessions/<data>-<tema>.md, reviews/<arquivo>. Não
    permite escrever em _templates/ ou _meta/.

    Args:
        path: relativo à raiz do workspace, ex: NOW.md.
        content: conteúdo do arquivo.
    """
    full = _safe_os_path(path, for_write=True)
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(content, encoding="utf-8")
    return {"ok": True, "fullPath": str(full)}


def os_read(path: str) -> dict:
    """Lê arquivo do nível do OS do workspace.

    NOW.md, INBOX.md, templates em _templates/, sessões e reviews.

    Args:
        path: relativo à raiz do workspace, ex: INBOX.md ou _templates/learning-review.md.
    """
    full = _safe_os_path(path, for_write=False)
    content = (
        full.read_text(encoding="utf-8")
        if full.exists()
        else f"(arquivo não existe: {path})"
    )
    return {"content": content}
