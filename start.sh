#!/usr/bin/env bash
# Starts the backend, which also serves the frontend (no separate frontend process).
set -euo pipefail
cd "$(dirname "$0")/backend"

[ -f .env ] || cp .env.example .env
uv sync

export $(grep -v '^#' .env | xargs)
exec uv run tutor-os-py
