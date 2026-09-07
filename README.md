# AI Code Tutor OS

> **A personal AI coding tutor and cognitive harness built for progressive overload.**  
> Most AI coding assistants rob you of the learning loop. Tutor OS does the opposite: it helps you build the learning road, keeps you on track, stress-tests your mental models, and grows with you as you tackle harder engineering challenges.

---

## 🧭 Why Tutor OS?

Chat/AI agents optimize for finishing the task today, often leaving you with code you don't fully understand and won't remember next week.

Tutor OS is designed around **cognitive scaffolding**:
- **Builds the road**: Organizes your learning into structured milestones and project arcs.
- **Keeps you accountable**: Detects when you're stuck, probes your architectural assumptions, and refuses to just spoon-feed solutions.
- **Progressive overload**: Systematically ramps up difficulty as your mental models solidify.

---

## 🧠 Core Architecture & Industry Patterns

```text
┌───────────────────────────────────────────────────────────────┐
│                   DESKTOP & WEB INTERFACE                     │
│   • Tauri (Rust Shell) / Responsive SPA                       │
│   • Theme Customization • Streaming SSE • Workspace Panels    │
└───────────────────────────────┬───────────────────────────────┘
                                │ HTTP / SSE
                                ▼
┌───────────────────────────────────────────────────────────────┐
│               TUTOR OS BACKEND (Pydantic-AI 2.0)              │
│                                                               │
│   ┌────────────────────────────────────────────────────────┐  │
│   │                      TUTOR HUB                         │  │
│   │   Orchestrates turn, manages session, tracks learner   │  │
│   └───────────┬────────────────────────────────┬───────────┘  │
│               │                                │              │
│       A2A Delegation                   Dynamic JIT Skills     │
│   (Isolated Context Loop)           (In-turn Personality/Role)│
│               │                                │              │
│       ┌───────┴────────┐              ┌────────┴────────┐     │
│       │ • Researcher   │              │ • Challenger    │     │
│       │ • Assigner     │              │ • Breaker       │     │
│       │ • Pair Partner │              │ • Scaffolder    │     │
│       │ • Architect    │              │ • Reviewer      │     │
│       └────────────────┘              └─────────────────┘     │
│                                                               │
│   ┌────────────────────────────────────────────────────────┐  │
│   │             HIERARCHICAL MEMORY SUBSYSTEM              │  │
│   │   Working Memory • Living Library • Episodes • SQLite  │  │
│   │   Observations Log • Memory Audits • Learner Profile   │  │
│   └────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### 1. Agent-to-Agent (A2A) Protocol vs. Dynamic JIT Skills
Monolithic prompts degrade quickly when tasks grow complex. Tutor OS splits cognition into two distinct patterns:
- **A2A Protocol (Isolated Sub-Agents)**: Heavy, multi-step subtasks (like deep web research or workspace assignment parsing) run in isolated agent contexts via typed delegation tools. This keeps the primary Tutor conversation window clean and free of tool-chatter token bloat.
- **Dynamic JIT Skills**: Fast behavioral injections (`challenger` to poke holes in logic, `breaker` to generate adversarial edge cases, `scaffolder` to provide minimal interfaces). These are loaded directly into the active turn so the conversation history and learner context remain intact without expensive round-trips.

### 2. Multi-Layer Memory Management
- **Working Memory**: In-flight goals, current hypotheses, and immediate roadblocks.
- **Episodes & Observations**: Captures where you experienced cognitive friction, what concepts finally clicked, and recurring patterns.
- **Living Library & Audits**: Long-term storage backed by SQLite and meta-indexes, preventing contradictory advice and tracking skill acquisition over time.
- **Workspaces & Learner Profile**: Scopes context to specific repositories, tracking customized learning arcs and goals across independent projects.

### 3. Native Desktop (Tauri + Rust) & Customizable UI
- **Tauri Shell**: Native, lightweight desktop experience with minimal memory footprint compared to Electron.
- **Theme Customization**: Tailor the visual interface for high-focus terminal sessions or late-night deep work.
- **Real-Time Streaming**: Low-latency SSE chat streaming with structured UI event cards for tool executions and skill activations.

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
