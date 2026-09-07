"""Redirects every test at a throwaway project root.

`storage.py` resolves PROJECT_ROOT/WORKSPACE_ROOT/DB_PATH at import time, and
the tool modules capture their file paths from it at import time too. So the
environment has to be set before anything under `tutor_os` is imported — hence
the import-free top of this file.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TMP_ROOT = Path(tempfile.mkdtemp(prefix="tutor-os-tests-"))
os.environ["TUTOR_OS_ROOT"] = str(_TMP_ROOT)
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")

import pytest

from tutor_os.storage import META_DIR, WORKSPACE_ROOT


@pytest.fixture
def workspace(tmp_path_factory: pytest.TempPathFactory):
    """Empties the shared workspace so each test starts from a clean slate.

    Yields the workspace root. Tests that need the meta dir use `meta_dir`.
    """
    import shutil

    if WORKSPACE_ROOT.exists():
        shutil.rmtree(WORKSPACE_ROOT)
    WORKSPACE_ROOT.mkdir(parents=True)
    META_DIR.mkdir(parents=True)
    yield WORKSPACE_ROOT


@pytest.fixture
def meta_dir(workspace: Path) -> Path:
    return META_DIR
