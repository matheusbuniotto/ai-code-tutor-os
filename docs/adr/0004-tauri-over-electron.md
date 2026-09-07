# 0004 — Tauri over Electron for the desktop shell

**Status:** Accepted
**Date:** 2026-09

## Context

The app is a Python backend (FastAPI, SSE) plus a plain static frontend — no
build step, no bundler, no framework. It already runs in a browser against
`localhost:4115`.

Desktop packaging needed to add three things and nothing else: a window, a
managed backend process, and an installer.

## Decision

**Tauri 2** (`desktop/src-tauri`), a Rust shell that renders the existing
`frontend/` in the operating system's own webview.

The backend runs as a managed child process in one of two modes:

- **Dev** — spawns the checkout's `.venv/bin/uvicorn` directly. Notably *not*
  `uv run uvicorn`: `uv run` makes uvicorn a grandchild, so killing it on quit
  orphans the actual server. One process, one kill.
- **Packaged** — spawns a frozen PyInstaller binary as a Tauri sidecar.

The bundle ships `frontend/` and `backend/.agents` as resources, copied into
the app data directory on first run. `TUTOR_OS_ROOT` then points the backend
at that directory, so the packaged app gets a normal-looking project root and
creates its workspace and database there lazily.

## Why not Electron

**Electron's advantage is a Node runtime in the shell. We have no use for
one.** The backend is Python and the frontend is static files. Electron would
have meant bundling Chromium and Node purely to open a window — roughly
100 MB before any of our own code, on top of the Python runtime we already
have to ship.

Tauri uses the system webview instead, so the shell is a small Rust binary.
The release profile is tuned accordingly (`lto`, `codegen-units = 1`,
`strip`, `opt-level = "s"`).

Electron would have won if we needed identical rendering across platforms, or
deep Node integration in the shell. We need neither.

## Consequences

**System webview means per-platform rendering differences.** WebKit on macOS,
WebView2 on Windows, WebKitGTK on Linux. The frontend is plain HTML/CSS/JS,
which keeps the exposure small, but it is real and untested surface.

**Rust in the toolchain.** Building the desktop app needs a Rust toolchain
that backend contributors otherwise never touch. The backend and browser
frontend remain fully usable without it.

**Process lifecycle is ours to get right.** Both spawn modes leave the child
running if dropped, so the backend is killed explicitly on exit. A missed path
here leaks a server holding port 4115.

**Two runtimes to ship.** Rust shell plus a frozen Python backend. Smaller
than Electron plus Python, but not small.
