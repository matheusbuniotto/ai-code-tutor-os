# AI Code Tutor OS

> **A personal AI coding tutor and cognitive harness built for progressive overload.**  
> Most AI coding assistants act like autocompletes that rob you of the learning loop. Tutor OS does the opposite: it helps you build the learning road, keeps you on track, stress-tests your mental models, and grows with you as you tackle harder engineering challenges.

---

## 🧭 Why Tutor OS?

Autocomplete and chat agents optimize for finishing the task today, often leaving you with code you don't fully understand and won't remember next week.

Tutor OS is designed around **cognitive scaffolding**:
- **Builds the road**: Organizes your learning into structured milestones, triage inboxes, and project arcs.
- **Keeps you accountable**: Probes your architectural assumptions, tests edge cases with adversarial skills, and refuses to spoon-feed code.
- **Progressive overload**: Calibrates difficulty to your personal profile so you stay in the sweet spot between boredom and panic.

---

## 🧠 Architecture Overview

```text
┌───────────────────────────────────────────────────────────────┐
│                   DESKTOP & WEB INTERFACE                     │
│   • Tauri (Rust Shell) • Web SPA • Customizable Themes        │
│   • Streaming SSE • Dynamic Cards • Workspace Selector        │
└───────────────────────────────┬───────────────────────────────┘
                                │ HTTP / SSE
                                ▼
┌───────────────────────────────────────────────────────────────┐
│               TUTOR OS BACKEND (Pydantic-AI 2.0)              │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                     SESSION ENGINE                      │  │
│  │   Prompt Personalization • Auto-Compact • Rescue Loop   │  │
│  └──────────────┬───────────────────────────┬──────────────┘  │
│                 │                           │                 │
│         A2A Orchestration           Dynamic JIT Skills        │
│                 ▼                           ▼                 │
│        ┌─────────────────┐         ┌─────────────────┐        │
│        │ • Tutor (Hub)   │         │ • Challenger    │        │
│        │ • Researcher    │         │ • Breaker       │        │
│        │ • Assigner      │         │ • Scaffolder    │        │
│        │ • Pair Partner  │         │ • Teacher       │        │
│        └────────┬────────┘         └─────────────────┘        │
│                 │                                             │
│                 ▼                                             │
│  ┌──────────────────────────────┐  ┌───────────────────────┐  │
│  │       EXTERNAL SENSORS       │  │   PERSISTENCE LAYER   │  │
│  │ • Web Search & Docs Scraper  │  │ • SQLite Thread DB    │  │
│  │ • ArXiv Papers API           │  │ • Working Memory      │  │
│  │ • Local Workspace FS         │  │ • Triage Inbox & Arcs │  │
│  │ • Model Gateway (OpenAI/Zen) │  │ • Learner Profile     │  │
│  └──────────────────────────────┘  └───────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 1. Agent-to-Agent (A2A) Protocol & Context Isolation
Monolithic agent prompts degrade quickly as tasks grow complex. Tutor OS decouples coordination:
- **Tutor Hub**: Owns the learner conversation and instructional strategy.
- **Isolated Sub-Agents**: Heavy tasks (iterative documentation searches, workspace parsing, project arc assignments) execute inside independent agent contexts (`agent.run()` A2A). This keeps the main Tutor conversation context razor-sharp and free from token-heavy tool output.

### 2. Dynamic JIT Skills (In-Turn Intervention)
Rather than spawning an out-of-process agent for every pedagogical action, Tutor OS uses JIT in-turn skills:
- **`challenger`**: Pokes holes in naive assumptions before you write code.
- **`breaker`**: Generates adversarial edge cases to test your implementation.
- **`scaffolder`**: Offers minimal interfaces and structural type skeletons.
- **`teacher`**: Steps in with targeted mental models when you ask for conceptual clarity.
*Skills inject directly into the Tutor's active turn, retaining full thread history without stateless round-trip penalties.*

### 3. Deep Research: Live Web & ArXiv Papers
When navigating unfamiliar technologies or theoretical domains (e.g., distributed consensus, memory safety in Rust, concurrency in Go), the `researcher` sub-agent autonomously queries:
- **Technical Web Documentation**: Gathers API references, migration guides, and modern idioms.
- **ArXiv Research Papers**: Pulls primary source academic papers, extracting core algorithmic formulas and design trade-offs before reporting a concise synthesis back to your session.

### 4. Hierarchical Memory Management
- **Working Memory**: In-flight goals, active hypotheses, and immediate roadblocks.
- **Episodes & Observations**: Captures recurring misunderstandings, breakthroughs, and cognitive friction patterns.
- **Living Library & Audits**: Persistent SQLite knowledge base with self-auditing routines to resolve contradictions and track skill retention over time.
- **Workspaces**: Scopes context to specific repositories, preserving unique project notes and code context across independent codebases.

### 5. Personalization, Rescue Loop & Auto-Compact
- **Prompt Personalization**: Calibrates explanation depth and tone against your `learner_profile`—anchoring new concepts to your existing background.
- **Rescue Mode (`/api/rescue`)**: Intervenes when you are stuck in a frustrating bug loop, resetting confusion, isolating root causes, and guiding you back to first principles.
- **Thread Auto-Compact**: Automatically compresses long-running threads, preserving key architectural decisions and unresolved questions without hitting context ceilings.
- **Triage Inbox**: Dump raw thoughts, unvetted links, and scratchpad notes into an asynchronous triage inbox that gets organized into future milestones.

### 6. Native Desktop Shell (Tauri + Rust) & Theme Customization
- **Tauri Desktop Shell**: A lightweight native desktop client with instant startup and minimal RAM footprint.
- **Customizable Themes**: Switch between high-contrast terminal themes and calm dark palettes for late-night deep work sessions.
- **Streaming SSE**: Low-latency token streaming with dedicated UI event cards for tool calls and skill interventions.

---

## 🚀 Quick Start

### 1. Backend Setup

Prerequisites: Python 3.11+ and [`uv`](https://docs.astral.sh/uv/).

```bash
cd backend
cp .env.example .env
# Edit .env with your OpenAI or OpenCode compatible API key

# Run the backend server
uv run tutor-os-py
```

The server boots on port `4115` by default, exposing SSE streaming endpoints and serving the frontend.

### 2. Desktop App (Tauri)

Prerequisites: [Rust & Cargo](https://rustup.rs/).

```bash
cd desktop/src-tauri
cargo tauri dev
```

---

## 📚 Architecture Decision Records (ADRs)

Key architectural trade-offs and structural choices are maintained under `docs/adrs/`:
- **ADR-001**: Choosing Pydantic-AI 2.0 over LangChain for deterministic typing and structured agent-to-agent delegation.
- **ADR-002**: JIT In-Turn Skills vs. Out-of-Process Agents for pedagogical intervention.
- **ADR-003**: Local-First SQLite Schema for Hierarchical Memory vs. Vector-Only Retrieval.

---

## 🤝 Contributing

Contributions are welcome! Check out [`CONTRIBUTING.md`](CONTRIBUTING.md) for local development workflows and code conventions.

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
