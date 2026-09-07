"""Guards the LLM-facing tool schemas against silent edits.

A tool's docstring is not commentary: pydantic-ai sends the summary as the
tool description and each `Args:` entry as a parameter description. Rewording
one changes agent behavior with nothing in the diff to say so.

These tests snapshot exactly what the model receives. A failure is not
automatically a bug — it means the contract moved, and you should look at the
diff and, if it was deliberate, regenerate:

    UPDATE_SNAPSHOTS=1 uv run pytest tests/test_tool_contract.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from pydantic_ai import Tool

from tutor_os.server import _AGENT_TOOL_FUNCTIONS

SNAPSHOT_PATH = Path(__file__).parent / "snapshots" / "tool_schemas.json"


def _all_tool_functions() -> dict[str, object]:
    """Every distinct tool function registered on any agent, keyed by name."""
    return {fn.__name__: fn for fns in _AGENT_TOOL_FUNCTIONS.values() for fn in fns}


def _schema_for(fn) -> dict:
    schema = Tool(fn).function_schema
    return {
        "description": schema.description,
        "parameters": schema.json_schema.get("properties", {}),
        "required": sorted(schema.json_schema.get("required", [])),
    }


def current_schemas() -> dict[str, dict]:
    return {name: _schema_for(fn) for name, fn in sorted(_all_tool_functions().items())}


def test_tool_schemas_match_snapshot():
    schemas = current_schemas()

    if os.environ.get("UPDATE_SNAPSHOTS"):
        SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
        SNAPSHOT_PATH.write_text(json.dumps(schemas, indent=2, sort_keys=True) + "\n")
        pytest.skip("snapshot regenerated")

    assert SNAPSHOT_PATH.exists(), (
        f"missing {SNAPSHOT_PATH}; create it with UPDATE_SNAPSHOTS=1 uv run pytest"
    )
    expected = json.loads(SNAPSHOT_PATH.read_text())

    assert set(schemas) == set(expected), (
        "the set of tools exposed to the model changed: "
        f"added={sorted(set(schemas) - set(expected))} "
        f"removed={sorted(set(expected) - set(schemas))}"
    )
    for name in sorted(schemas):
        assert schemas[name] == expected[name], f"tool contract changed for {name!r}"


@pytest.mark.parametrize("name,fn", sorted(_all_tool_functions().items()))
def test_every_tool_has_a_description(name: str, fn):
    """A tool with no description is a tool the model has to guess at."""
    description = Tool(fn).function_schema.description
    assert description and description.strip(), f"{name} has no docstring summary"


@pytest.mark.parametrize("name,fn", sorted(_all_tool_functions().items()))
def test_every_parameter_is_documented(name: str, fn):
    """Undocumented parameters are the most common cause of bad tool calls."""
    properties = Tool(fn).function_schema.json_schema.get("properties", {})
    undocumented = [p for p, spec in properties.items() if not spec.get("description")]
    assert not undocumented, f"{name} has undocumented parameters: {undocumented}"
