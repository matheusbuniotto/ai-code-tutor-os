"""Behavioral evals against a real model gateway. Deselected by default.

    uv run pytest -m llm

These cost tokens and are not deterministic, so they never run in CI or on
commit. Run them when you change an agent's instructions — that is the change
the deterministic suite cannot judge.

Each eval asserts a rule the Tutor's instructions actually state, so a failure
means the prompt stopped carrying its own rules, not that the model was moody.
Keep assertions behavioral (did it call the tool, did it answer at all) rather
than matching exact wording.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from tutor_os.agents import tutor

pytestmark = [
    pytest.mark.llm,
    pytest.mark.skipif(
        not (os.environ.get("OPENCODE_API_KEY") or os.environ.get("OPENAI_API_KEY")),
        reason="no model gateway key in the environment",
    ),
]


def _tool_calls(result) -> list[str]:
    return [
        part.tool_name
        for message in result.all_messages()
        for part in message.parts
        if getattr(part, "tool_name", None)
    ]


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_never_ends_a_turn_in_silence(meta_dir: Path):
    """The Tutor's instructions forbid tool-only turns: every user message gets text."""
    result = await tutor.agent.run("What should I focus on right now?")
    assert result.output and result.output.strip(), "turn ended with no text for the learner"


@pytest.mark.anyio
async def test_orients_itself_instead_of_asking_where_we_left_off(meta_dir: Path):
    """Core invariant: finding facts is the agent's job. It should read state
    rather than push the question back to the learner."""
    result = await tutor.agent.run("Let's continue.")

    asked_back = "where did we leave off" in result.output.lower()
    assert not asked_back, "agent asked the learner to reconstruct their own context"
    assert _tool_calls(result), "agent should have read its own state to orient"


@pytest.mark.anyio
async def test_records_a_durable_fact_as_an_observation(meta_dir: Path):
    """Instructions say to capture concrete facts as they appear, unprompted."""
    result = await tutor.agent.run(
        "For the record: I've decided to standardize all new services on Rust, "
        "because the team keeps hitting GC pauses in the hot path."
    )
    memory_tools = {"observation_capture", "update_working_memory"}
    assert memory_tools & set(_tool_calls(result)), (
        f"no memory tool called; got {_tool_calls(result)}"
    )


@pytest.mark.anyio
async def test_tool_calls_stay_economical(meta_dir: Path):
    """Instructions cap a conceptual answer at 1-2 tool calls; runaway loops are
    the regression to catch here."""
    result = await tutor.agent.run("Explain the trade-off between WAL and shadow paging.")
    assert len(_tool_calls(result)) <= 4, f"too many tool calls: {_tool_calls(result)}"
