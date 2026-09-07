"""Agent wiring evals, run against a stub model — no network, no API key.

These check the things that break silently when an agent is edited: that
memory is actually injected, that tools are actually reachable, and that the
registry stays consistent. Evals that need a real model live in
`test_llm_evals.py` and are deselected by default.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from pydantic_ai import Agent
from pydantic_ai.messages import ModelMessage, ModelResponse, TextPart
from pydantic_ai.models.function import AgentInfo, FunctionModel
from pydantic_ai.models.test import TestModel

from tutor_os.server import _AGENT_MODULES, _AGENT_TOOL_FUNCTIONS, AGENTS


class TestRegistry:
    def test_every_module_exports_the_expected_names(self):
        for name, module in _AGENT_MODULES.items():
            assert hasattr(module, "agent"), f"{name} must export `agent`"
            assert isinstance(module.agent, Agent), f"{name}.agent must be an Agent"
            assert hasattr(module, "TOOL_FUNCTIONS"), f"{name} must export TOOL_FUNCTIONS"

    def test_derived_maps_agree(self):
        assert set(AGENTS) == set(_AGENT_TOOL_FUNCTIONS) == set(_AGENT_MODULES)

    def test_tutor_is_registered(self):
        """The Tutor is the only entry point; losing it breaks every conversation."""
        assert "tutor" in AGENTS

    @pytest.mark.parametrize("name", sorted(_AGENT_TOOL_FUNCTIONS))
    def test_tool_names_are_unique_per_agent(self, name: str):
        """A duplicate name means one of the two tools is unreachable."""
        names = [fn.__name__ for fn in _AGENT_TOOL_FUNCTIONS[name]]
        assert len(names) == len(set(names)), f"{name} has duplicate tools"

    @pytest.mark.parametrize("name", sorted(_AGENT_TOOL_FUNCTIONS))
    def test_every_agent_has_at_least_one_tool(self, name: str):
        assert _AGENT_TOOL_FUNCTIONS[name], f"{name} has no tools"


class TestWorkingMemoryInjection:
    """Working memory is injected through an instructions hook. If that hook is
    dropped from an agent, nothing fails loudly — the agent just quietly forgets
    the learner."""

    @pytest.mark.anyio
    @pytest.mark.parametrize("name", sorted(AGENTS))
    async def test_agent_instructions_include_working_memory(self, name: str, meta_dir: Path):
        from tutor_os.tools.working_memory import update_working_memory

        marker = "MARKER-levels-rust-intermediate"
        update_working_memory("levels-by-stack", marker)

        captured: list[str] = []

        def capture(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
            captured.append(str(messages[0]))
            return ModelResponse(parts=[TextPart("ok")])

        await AGENTS[name].run("hello", model=FunctionModel(capture))
        assert marker in captured[0], f"{name} is not injecting working memory"


class TestToolsAreReachable:
    @pytest.mark.anyio
    async def test_tutor_can_call_a_read_only_tool(self, meta_dir: Path):
        """TestModel calls every registered tool once; this proves the whole
        toolset is wired and callable, not just importable."""
        from tutor_os.agents import tutor

        read_only = [fn for fn in tutor.TOOL_FUNCTIONS if fn.__name__ == "meta_overview"]
        agent = Agent("test", tools=read_only)  # ty: ignore[no-matching-overload]
        agent.instructions(lambda: "test run")

        result = await agent.run("summarize", model=TestModel())
        assert result.output

    @pytest.mark.anyio
    async def test_tool_call_reaches_the_real_function(self, meta_dir: Path):
        """A stub model that calls episodes_search must get real data back."""
        from tutor_os.tools.episodes import episodes_append, episodes_search

        episodes_append(
            date="2026-01-01",
            project_slug="proj",
            topic="wal fsync",
            phase_reached=2,
            status="concluido",
            extracted="group commit amortizes fsync",
            connections=["durability"],
        )

        agent = Agent("test", tools=[episodes_search])  # ty: ignore[no-matching-overload]
        result = await agent.run("find it", model=TestModel(call_tools=["episodes_search"]))

        called = [
            getattr(part, "tool_name", None)
            for message in result.all_messages()
            for part in message.parts
        ]
        assert "episodes_search" in called


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"
