"""Port of src/mastra/model.ts.

Runtime-switchable model config against an OpenAI-compatible gateway
(OpenCode Zen by default). pydantic-ai lets us pass a Model instance per
`agent.run(..., model=...)` call, so switching models at runtime doesn't
require rebuilding the Agent.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

_base_url = (
    os.environ.get("OPENCODE_BASE_URL")
    or os.environ.get("OPENAI_BASE_URL")
    or "https://opencode.ai/zen/go/v1"
)
_api_key = os.environ.get("OPENCODE_API_KEY") or os.environ.get("OPENAI_API_KEY") or ""


@dataclass(frozen=True)
class CuratedModel:
    id: str
    name: str
    provider: str


CURATED_MODELS: list[CuratedModel] = [
    CuratedModel(
        "muse-spark-1.2-contributor",
        "Muse Spark 1.2 Contributor",
        "OpenCode Go (Recommended)",
    ),
    CuratedModel("deepseek-v4-flash", "DeepSeek V4 Flash", "OpenCode / DeepSeek"),
    CuratedModel("gpt-4o", "GPT-4o", "OpenAI"),
    CuratedModel("gpt-4o-mini", "GPT-4o Mini", "OpenAI"),
    CuratedModel("claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet", "Anthropic"),
    CuratedModel("gemini-2.0-flash", "Gemini 2.0 Flash", "Google"),
    CuratedModel("qwen-2.5-coder-32b", "Qwen 2.5 Coder 32B", "Alibaba"),
]

_active_model_name = os.environ.get("TUTOR_MODEL") or "deepseek-v4-flash"


def get_active_model_name() -> str:
    return _active_model_name


def set_active_model_name(name: str) -> str:
    global _active_model_name
    if name and name.strip():
        _active_model_name = name.strip()
    return _active_model_name


def get_runtime_config() -> dict:
    return {
        "model": _active_model_name,
        "baseURL": _base_url,
        "hasApiKey": bool(_api_key),
        "curatedModels": [c.__dict__ for c in CURATED_MODELS],
    }


def update_runtime_config(
    model: str | None = None, base_url: str | None = None, api_key: str | None = None
) -> dict:
    global _base_url, _api_key
    if model and model.strip():
        set_active_model_name(model)
    if base_url and base_url.strip():
        _base_url = base_url.strip()
    if api_key and api_key.strip():
        _api_key = api_key.strip()
    return get_runtime_config()


def get_model(model_name: str | None = None) -> OpenAIChatModel:
    chosen = model_name or _active_model_name
    return OpenAIChatModel(chosen, provider=OpenAIProvider(base_url=_base_url, api_key=_api_key))
