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
│   │   Orchestrates turn, prompt personalization, compact   │  │
│   └───────────┬────────────────────────────────┬───────────┘  │
│               │                                │              │
│       A2A Delegation                   Dynamic JIT Skills     │
│   (Isolated Context Loop)           (In-turn Personality/Role)│
│               │                                │              │
│       ┌───────┴──────────────┐        ┌────────┴────────┐     │
│       │ • Researcher (Web /  │        │ • Challenger    │     │
│       │   ArXiv Integration) │        │ • Breaker       │     │
│       │ • Assigner (Arcs)    │        │ • Scaffolder    │     │
│       │ • Pair Partner       │        │ • Teacher       │     │
│       │ • Rescue Handler     │        │ • Reviewer      │     │
│       └──────────────────────┘        └─────────────────┘     │
│                                                               │
│   ┌────────────────────────────────────────────────────────┐  │
│   │             HIERARCHICAL MEMORY & INBOX                │  │
│   │   Working Memory • Living Library • Episodes • SQLite  │  │
│   │   Triage Inbox • Memory Audits • Learner Profile       │  │
│   └────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### 1. Agent-to-Agent (A2A) Protocol vs. Dynamic JIT Skills
Monolithic prompts degrade quickly when tasks grow complex. Tutor OS splits cognition into two distinct patterns:
- **A2A Protocol (Isolated Sub-Agents)**: Heavy, noisy subtasks run in isolated agent contexts via typed delegation tools. The primary Tutor thread stays clean and focused on your learning dialogue.
- **Dynamic JIT Skills**: Fast behavioral injections (`challenger` to poke holes in assumptions, `breaker` to invent adversarial edge cases, `scaffolder` to provide minimal interfaces). These are loaded directly into the active turn so conversation history remains intact without expensive round-trips.

### 2. Deep Research: Live Web & ArXiv Integration
When exploring new domains or unfamiliar primitives (e.g. distributed systems, lower-level Go/Rust concurrency), the `researcher` sub-agent independently queries both:
- **Technical Web Documentation**: Pulls official release notes, APIs, and modern code conventions.
- **ArXiv Papers**: Extracts primary research insights and algorithmic foundations, digesting them into concise mental models before returning to your main thread.

### 3. Personalization, Auto-Compact & Recovery
- **Prompt Personalization**: Bridges new concepts to your known strengths by anchoring to your `learner_profile` (e.g., explaining memory safety through familiar systems or data analogies).
- **Auto-Compact**: Intelligent context compression for long-running threads—periodically distilling message histories so key decisions and mental models survive without blowing token limits.
- **Triage Inbox & Rescue Loop (`/api/rescue`)**:
  - **Inbox**: Dump raw thoughts, unvetted links, and scratchpad notes into an asynchronous triage inbox that gets scheduled into future arcs.
  - **Rescue Mode**: Triggers when you get stuck in a frustrating bug loop or cognitive fatigue—intervening to reset confusion, isolate root causes, and walk you back to first principles.

### 4. Multi-Layer Memory Management
- **Working Memory**: In-flight goals, active hypotheses, and immediate roadblocks.
- **Episodes & Observations**: Captures where you experienced cognitive friction, what concepts finally clicked, and recurring patterns.
- **Living Library & Audits**: Long-term storage backed by SQLite and meta-indexes, preventing contradictory advice and tracking skill acquisition over time.
- **Workspaces**: Scopes context to specific repositories and independent projects.

### 5. Native Desktop (Tauri + Rust) & Customizable UI
- **Tauri Shell**: Native desktop experience with near-instant boot and minimal RAM footprint.
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
