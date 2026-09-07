# Tutor OS

I learn by building. Reading documentation, watching conference talks, or asking an AI to explain a concept gives a quick feeling of understanding, but it rarely sticks. A week later, when I have to design around real constraints, the intuition is gone.

The only way technical judgment actually develops is through direct contact with the problem: mapping invariants on paper, writing the minimal code that runs, breaking it at the edges on purpose, and observing how it fails.

Most AI coding assistants do the opposite. They act as autocompletes that jump straight to a full solution, turning the user into a paste buffer. You get working code in your repository, but you skip the entire friction loop that builds judgment.

Tutor OS is a local learning system built around a stubborn rule: **a capability only counts as learned when it traces back to reproducible evidence on disk.** Not "I read about LSM compaction", but a benchmark, a test, a reproduction command, and the failure modes you personally verified.

---

## 🧠 How it works

Projects move through four phases (the Inverted Pyramid) before any capability gets checked off:

1. **Macro topology on paper.** Sketch the invariants and data flow before opening an editor. If you cannot explain the failure modes on an index card, writing code only hides the confusion.
2. **Tracer bullet.** The smallest possible end-to-end slice that compiles and runs. The tutor provides the boundary skeleton with named gaps; you write the actual logic.
3. **Break edges.** Intentionally break it. Fuzz boundary conditions, trigger race conditions, cut network connections.
4. **Architecture note.** One page: invariants, trade-offs, when not to use this design, and what broke along the way.

What comes out of this lands in a four-layer memory on disk:
- `WORKING_MEMORY.md` — a Markdown profile injected fresh into every model call.
- `EPISODES.jsonl` — append-only session records (what broke, what was extracted).
- `ARCS.json` & `EVIDENCES.json` — the skill map and the verified reproduction commands backing it.
- `workspace/<slug>/` — project-specific artifacts, alongside SQLite for conversation thread history.

---

## 🏛️ Architecture Overview

```text
┌───────────────────────────────────────────────────────────────┐
│                   DESKTOP & WEB INTERFACE                     │
│   • Tauri 2 (Rust Shell) • Static SPA (No Build Step)         │
│   • Streaming SSE • Event Cards • Workspace Selector          │
└───────────────────────────────┬───────────────────────────────┘
                                │ HTTP / SSE (Port 4115)
                                ▼
┌───────────────────────────────────────────────────────────────┐
│               TUTOR OS BACKEND (FastAPI + Pydantic-AI)        │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                     SESSION ENGINE                      │  │
│  │   Working Memory Injection • Personalizer • Rescue Loop │  │
│  └──────────────┬───────────────────────────┬──────────────┘  │
│                 │                           │                 │
│         A2A Delegation              In-Turn Skills            │
│                 ▼                           ▼                 │
│        ┌─────────────────┐         ┌─────────────────┐        │
│        │ • Tutor (Hub)   │         │ • Challenger    │        │
│        │ • Researcher    │         │ • Breaker       │        │
│        │ • Assigner      │         │ • Scaffolder    │        │
│        │ • Pair Partner  │         │ • Teacher       │        │
│        │ • Architect     │         │ • Reviewer      │        │
│        └────────┬────────┘         └─────────────────┘        │
│                 │                                             │
│                 ▼                                             │
│  ┌──────────────────────────────┐  ┌───────────────────────┐  │
│  │       EXTERNAL SENSORS       │  │   PERSISTENCE LAYER   │  │
│  │ • Web Search & Docs Scraper  │  │ • SQLite Thread DB    │  │
│  │ • ArXiv Academic API         │  │ • WORKING_MEMORY.md   │  │
│  │ • Local Workspace FS         │  │ • EPISODES.jsonl      │  │
│  │ • OpenAI-Compatible Gateway  │  │ • ARCS & EVIDENCES    │  │
│  └──────────────────────────────┘  └───────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Key Features

### 1. Agents vs. In-Turn Skills (Context Isolation Without History Loss)
Early on, every persona (Teacher, Challenger, Reviewer) was a separate agent called via agent-to-agent delegation. That was a mistake: delegating to another agent is a stateless round trip. The callee only gets whatever prompt you pass it and cannot see the active thread. When a Teacher is asked why an implementation failed three turns ago, it needs the full conversation history, not a blank slate.

We separated personas by one technical question: **does this persona run a noisy multi-step tool loop?**
- **Autonomous Agents (A2A)**: Heavy tasks that run iterative tool loops (`researcher` scraping docs, `assigner` planning project milestones) run in isolated agent contexts. This keeps the Tutor's context window clean from token-heavy tool dumps.
- **In-Turn Skills**: Pedagogical behaviors (`challenger`, `breaker`, `scaffolder`, `teacher`, `reviewer`) are loaded directly into the Tutor's active turn via `load_capability`. The Tutor stays in-character, retains the entire thread history, and costs zero round-trip penalties. See [ADR 0002](docs/adr/0002-a2a-delegation-and-skills.md).

### 2. Deep Research: Live Web Docs & ArXiv Papers
When exploring unfamiliar systems (distributed consensus, memory models in Rust, LSM write amplification), the `researcher` agent queries:
- **Technical Documentation**: Web search and doc scraping for API contracts, edge-case bug trackers, and modern patterns.
- **ArXiv Papers**: Primary source academic papers, extracting core algorithmic bounds and design trade-offs before reporting a synthesis back to your session.

### 3. Multi-Layer Memory on Disk (No Vector Database)
Vector databases are the wrong abstraction for a single engineer's learning memory. When an LLM summarizes a concept inaccurately, you want to open a file in your editor, fix the line, and save.
- **Working Memory (`WORKING_MEMORY.md`)**: Injected into every agent call via instructions hooks. Updated one section at a time to prevent the model from dropping context.
- **Episodes (`EPISODES.jsonl`)**: Append-only session records capturing what broke and what was extracted.
- **Evidence Graph (`ARCS.json`, `EVIDENCES.json`)**: Tracks active capabilities and the exact test or benchmark commands required to reproduce them.
- **SQLite Database**: Used exclusively for high-volume chat threads, message ordering, and streaming tool event logs. See [ADR 0003](docs/adr/0003-multi-layer-memory.md).

### 4. Rescue Loop & Dynamic Personalization
- **Rescue Mode (`/api/rescue`)**: When you get stuck in a circular debugging loop, the rescue handler intervenes, resets confusion, isolates the failure to first principles, and guides you back to an invariant test.
- **Learner Profile**: Calibrates explanation depth and technical analogies to your actual background without patronizing summaries.

### 5. Native Desktop Shell (Tauri 2)
- **Tauri 2 + Rust**: Spawns and manages the Python backend process with instant startup, minimal RAM usage, and no Electron overhead (see [ADR 0004](docs/adr/0004-tauri-over-electron.md)).
- **Zero-Build Frontend**: Plain HTML, CSS, and vanilla JS served directly by FastAPI. No Node bundler, no hydration mismatches, no build pipeline.

---

## 🗺️ Capability Arcs & Learning Road

Learning in Tutor OS is structured into **Capability Arcs** (`workspace/_meta/ARCS.json`). Unlike a passive course syllabus, a capability is marked as `verified` only when backed by reproducible L2 evidence.

### Arc 1: Investigation and Judgment of Software Behavior
*Physical intuition for execution, saturation, concurrency contention, and failures.*
- [ ] Diagnose lock contention under parallel concurrency
- [ ] Predict and mitigate I/O saturation in Write-Ahead Logging (WAL)
- [ ] Design idempotent execution and post-failure recovery mechanisms
- [ ] Judge memory layout trade-offs (AoS vs. SoA) and cache locality

### Arc 2: Reasoning About Distributed Systems and Resources
*Real trade-offs in data structures, inter-service communication, and storage.*
- [ ] Calculate and mitigate Write Amplification in LSM trees
- [ ] Implement flow control and reactive backpressure under overload
- [ ] Model eventual-consistency vs. linearizability guarantees and trade-offs

### Arc 3: Judgment and Engineering of AI Systems
*Context economics, agent reliability, and quantitative behavioral evals.*
- [ ] Design deterministic behavioral evaluation suites for agents
- [ ] Optimize context compression and distillation without losing reasoning
- [ ] Build guardrails for recovering from unreliable tool-call failures

---

## 🚀 Quick Start

### Backend & Web UI

Prerequisites: Python 3.12+ and [`uv`](https://docs.astral.sh/uv/).

```bash
cd backend
uv sync
cp .env.example .env
```

Edit `.env` with your API key (`OPENCODE_API_KEY` or `OPENAI_API_KEY`). Because there is no dotenv loader wired into the Python process, export it in your shell:

```bash
export $(cat .env | xargs)
uv run uvicorn tutor_os.server:app --port 4115 --reload
```

Open <http://localhost:4115>. The frontend is served directly by FastAPI.

### Desktop Shell (Tauri 2)

Prerequisites: [Rust and Cargo](https://rustup.rs/).

```bash
cd desktop/src-tauri
cargo tauri dev
```

---

## 📁 Layout

| Path | What it does |
|---|---|
| `backend/` | FastAPI server, pydantic-ai agents, tools, memory ([README](backend/README.md)) |
| `frontend/` | Static UI served by FastAPI (no build step) |
| `desktop/` | Tauri 2 shell that manages the backend process |
| `workspace/` | Project workspaces and memory files on disk |
| `docs/adr/` | Architecture Decision Records |

---

## 📚 Decisions (ADRs)

- [0001 — pydantic-ai as the agent runtime](docs/adr/0001-pydantic-ai-as-agent-runtime.md)
- [0002 — A2A delegation and Skills](docs/adr/0002-a2a-delegation-and-skills.md)
- [0003 — Multi-layer memory](docs/adr/0003-multi-layer-memory.md)
- [0004 — Tauri over Electron](docs/adr/0004-tauri-over-electron.md)

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for test instructions and guidelines on adding tools or skills. MIT licensed.
