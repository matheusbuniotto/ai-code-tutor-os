"""Path-containment regressions.

Agents choose these arguments, so a traversal here is reachable by prompt
injection, not just by a buggy caller. Every one of these escaped at some
point in this codebase's history.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from tutor_os.storage import WORKSPACE_ROOT, safe_path
from tutor_os.tools.os_files import _safe_os_path, os_read, os_write
from tutor_os.tools.workspace import _project_path, workspace_read, workspace_write

ESCAPES = [
    "../../etc/passwd",
    "..",
    "../",
    "ok/../../../outside",
    "/etc/passwd",
]


@pytest.mark.parametrize("evil", ESCAPES)
def test_safe_path_rejects_escapes(evil: str):
    with pytest.raises(ValueError):
        safe_path(WORKSPACE_ROOT, evil)


@pytest.mark.parametrize("evil", ESCAPES)
def test_project_slug_cannot_escape_the_workspace(evil: str):
    """The slug is a path segment too — validating only the relative path is not enough."""
    with pytest.raises(ValueError):
        _project_path(evil)


@pytest.mark.parametrize("evil", ESCAPES)
def test_project_relative_path_cannot_escape_the_project(evil: str):
    with pytest.raises(ValueError):
        _project_path("legit-project", evil)


@pytest.mark.parametrize("evil", ESCAPES)
def test_workspace_write_rejects_escaping_slug(evil: str, workspace: Path):
    with pytest.raises(ValueError):
        workspace_write(evil, "note.md", "payload")


@pytest.mark.parametrize("evil", ESCAPES)
def test_workspace_read_rejects_escaping_path(evil: str, workspace: Path):
    with pytest.raises(ValueError):
        workspace_read("legit-project", evil)


@pytest.mark.parametrize("evil", ESCAPES)
def test_os_files_reject_escapes(evil: str, workspace: Path):
    with pytest.raises(ValueError):
        _safe_os_path(evil)


@pytest.mark.parametrize("protected", ["_meta/PROFILE.md", "_templates/x.md"])
def test_os_write_refuses_protected_directories(protected: str, workspace: Path):
    """_meta is agent-managed memory and _templates is read-only; os_write is
    for NOW.md/INBOX.md/sessions, not for stomping either."""
    with pytest.raises(ValueError):
        os_write(protected, "payload")


def test_os_read_may_still_read_protected_dirs(workspace: Path):
    (WORKSPACE_ROOT / "_templates").mkdir(parents=True, exist_ok=True)
    (WORKSPACE_ROOT / "_templates" / "review.md").write_text("template", encoding="utf-8")
    assert os_read("_templates/review.md")["content"] == "template"


def test_legitimate_nested_paths_still_resolve(workspace: Path):
    # safe_path returns a resolved path, so compare against a resolved root
    # (/var is a symlink to /private/var on macOS).
    resolved = _project_path("demo", "01-topology/map.md")
    assert resolved.relative_to(WORKSPACE_ROOT.resolve()) == Path("demo/01-topology/map.md")
