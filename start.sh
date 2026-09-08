#!/usr/bin/env bash
# Preps the backend (venv + API key), then launches the Tauri desktop app,
# which spawns the dev backend itself and opens the UI window.
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"

cd "$root/backend"
[ -f .env ] || cp .env.example .env
uv sync

# Load .env into the environment, but never clobber a var the calling shell
# already exported (e.g. OPENCODE_API_KEY set in ~/.zshrc) with a blank
# placeholder from the .env template.
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  if [ -z "${!key:-}" ] && [ -n "$value" ]; then
    export "$key=$value"
  fi
done < .env

api_key="${OPENCODE_API_KEY:-${OPENAI_API_KEY:-}}"
if [ -z "$api_key" ]; then
  echo "No model API key found (OPENCODE_API_KEY / OPENAI_API_KEY not set in your shell or backend/.env)."
  read -r -p "Paste an API key to use for this run (leave blank to abort): " api_key
  if [ -z "$api_key" ]; then
    echo "No key provided. Set OPENCODE_API_KEY (or OPENAI_API_KEY) in backend/.env or your shell profile, then re-run." >&2
    exit 1
  fi
  export OPENCODE_API_KEY="$api_key"
fi

cd "$root/desktop/src-tauri"
exec cargo run
