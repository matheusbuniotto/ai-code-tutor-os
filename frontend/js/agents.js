// =========================================================================
// AGENT METADATA + A2A DELEGATION TRANSPARENCY (old sections 3.6 & 7 header)
// =========================================================================

import { escapeHtml } from './utils.js';

// Agent color/label map
// Mirrors the backend's AGENTS dict (server.py) exactly — every id it can
// ever tag a thread/message with, whether reachable from the selector
// dropdown directly (tutor/pair/architect) or only via A2A/Skills.
export const AGENT_META = {
  tutor:      { label: 'Tutor',      color: 'emerald' },
  pair:       { label: 'Pair',       color: 'sky'     },
  architect:  { label: 'Architect',  color: 'violet'  },
  assigner:   { label: 'Assigner',   color: 'lime'    },
  researcher: { label: 'Research',   color: 'amber'   },
  challenger: { label: 'Challenger', color: 'rose'    },
  reviewer:   { label: 'Reviewer',   color: 'orange'  },
  teacher:    { label: 'Teacher',    color: 'yellow'  },
  planner:    { label: 'Planner',    color: 'blue'    },
  scaffolder: { label: 'Scaffold',   color: 'teal'    },
  breaker:    { label: 'Breaker',    color: 'red'     },
};

// Idle (non-delegating) conductor badge label per directly-selectable agent.
export const AGENT_IDLE_LABEL = {
  tutor: '🧭 Tutor (Senior Navigator)',
  pair: '🤝 Pair (Programming Partner)',
  architect: '🏛️ Architect (Project & Career Strategist)',
};

export function currentIdleConductorLabel() {
  const select = document.getElementById('agent-selector');
  const agentId = select ? select.value : 'tutor';
  return AGENT_IDLE_LABEL[agentId] || AGENT_IDLE_LABEL.tutor;
}

export function agentBadgeClasses(agentId, small = false) {
  const meta = AGENT_META[agentId] || { label: agentId, color: 'zinc' };
  const c = meta.color;
  const sz = small ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5';
  return `${sz} rounded-full bg-${c}-950/80 text-${c}-300 border border-${c}-800 font-mono font-bold`;
}

// A2A Delegation Transparency & Conductor Indicator
export function updateConductorBadge(labelText, isActive = false) {
  const label = document.getElementById('conductor-agent-label');
  const dot = document.getElementById('conductor-pulse-dot');
  if (label) label.textContent = labelText;
  if (dot) {
    if (isActive) {
      dot.className = "w-2.5 h-2.5 rounded-full animate-ping bg-amber-400";
    } else {
      dot.className = "w-2 h-2 rounded-full animate-pulse";
    }
  }
}

export function getAgentDelegationInfo(toolName, skillId) {
  // Skills (challenger/teacher/reviewer/...) are always invoked through a
  // single framework tool called "load_capability" — the real skill name
  // only exists in its `id` argument (passed here as `skillId`), never in
  // `toolName`. Without this, every Skill call falls through to the
  // generic "System / Workspace Tool Execution" branch below.
  const norm = (skillId || toolName || "").toLowerCase().replace(/[-_]/g, '');
  if (norm.includes('assigner') || norm.includes('assignment')) {
    return {
      isDelegation: true,
      agentName: 'Assigner',
      role: 'Assignment Engine (Predict ➔ Measure ➔ Mutate ➔ Explain)',
      color: 'emerald',
      iconEmoji: '📋',
      headerText: '🧭 Tutor ➔ 📋 Assigner (Creating Challenge...)',
    };
  }
  if (norm.includes('challenger')) {
    return {
      isDelegation: true,
      agentName: 'Challenger',
      role: 'Mental Model Breaker (Attacks Concurrency & Failures)',
      color: 'rose',
      iconEmoji: '⚔️',
      headerText: '🧭 Tutor ➔ ⚔️ Challenger (Attacking Model...)',
    };
  }
  if (norm.includes('reviewer')) {
    return {
      isDelegation: true,
      agentName: 'Reviewer',
      role: 'Judgment Auditor (Trade-offs & Evidence Validation)',
      color: 'purple',
      iconEmoji: '🔍',
      headerText: '🧭 Tutor ➔ 🔍 Reviewer (Auditing Judgment...)',
    };
  }
  if (norm.includes('teacher')) {
    return {
      isDelegation: true,
      agentName: 'Teacher',
      role: 'Just-in-Time Socratic Teaching (Physical Intuition & Models)',
      color: 'amber',
      iconEmoji: '💡',
      headerText: '🧭 Tutor ➔ 💡 Teacher (Explaining JIT...)',
    };
  }
  if (norm.includes('planner')) {
    return {
      isDelegation: true,
      agentName: 'Planner',
      role: 'Phase & Curriculum Planning',
      color: 'blue',
      iconEmoji: '🗺️',
      headerText: '🧭 Tutor ➔ 🗺️ Planner (Planning Phase...)',
    };
  }
  if (norm.includes('scaffolder')) {
    return {
      isDelegation: true,
      agentName: 'Scaffolder',
      role: 'Tracer-Bullet Scaffolding',
      color: 'teal',
      iconEmoji: '🏗️',
      headerText: '🧭 Tutor ➔ 🏗️ Scaffolder (Scaffolding...)',
    };
  }
  if (norm.includes('breaker')) {
    return {
      isDelegation: true,
      agentName: 'Breaker',
      role: 'Edge-Case & Failure-Mode Breaker',
      color: 'red',
      iconEmoji: '💥',
      headerText: '🧭 Tutor ➔ 💥 Breaker (Breaking Edges...)',
    };
  }
  if (norm.includes('researcher') || norm.includes('arxiv')) {
    return {
      isDelegation: true,
      agentName: 'Researcher',
      role: 'arXiv Research Specialist (Primary Literature)',
      color: 'sky',
      iconEmoji: '📚',
      headerText: '🧭 Tutor ➔ 📚 Researcher (Researching arXiv...)',
    };
  }
  if (norm.includes('meta')) {
    return {
      isDelegation: false,
      agentName: 'Meta-Learning',
      role: 'NOW, Arc, and Project Synchronization',
      color: 'teal',
      iconEmoji: '🧭',
      headerText: '🧭 Tutor (Syncing Meta-Learn...)',
    };
  }
  if (norm.includes('arc') || norm.includes('capability')) {
    return {
      isDelegation: false,
      agentName: 'Judgment Arcs',
      role: 'Goal Management & Evidence Verification',
      color: 'emerald',
      iconEmoji: '🎯',
      headerText: '🧭 Tutor (Verifying Evidence...)',
    };
  }
  const displayName = skillId || toolName;
  return {
    isDelegation: false,
    agentName: `${displayName}()`,
    role: 'System / Workspace Tool Execution',
    color: 'zinc',
    iconEmoji: '⚙️',
    headerText: `🧭 Tutor (${displayName}...)`,
  };
}

// Renders one persisted (already-completed) A2A/Skill/tool call as a card,
// in the same shape as the live "tool-result" step built in sendChatMessage.
// Used to replay delegation/skill-call transparency after a page reload,
// since tool-call/tool-result SSE frames only used to exist in the live DOM.
export function buildToolEventCardHTML(ev) {
  const toolName = ev.toolName || "tool";
  const info = getAgentDelegationInfo(toolName, ev.skillId);
  const isError = Boolean(ev.isError);
  const args = ev.args || {};
  return `
    <div class="p-3 rounded-2xl theme-card border ${isError ? 'border-red-500/50 bg-red-950/30 text-red-300' : 'theme-border'} text-xs transition-all shadow-md space-y-2 my-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 font-bold min-w-0">
          <span class="text-xs inline-flex items-center justify-center shrink-0 select-none">${isError ? '⚠️' : info.iconEmoji}</span>
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs ${isError ? 'text-red-300' : 'theme-accent'}">${info.isDelegation ? 'A2A:' : 'Executed:'} <b>${escapeHtml(info.agentName)}</b></span>
            <span class="text-[10px] font-normal hidden sm:inline" style="color: var(--text-muted);">(${escapeHtml(info.role)})</span>
          </div>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 font-mono shrink-0" style="${isError ? 'color: #f87171; background-color: rgba(239, 68, 68, 0.15); border-color: #ef4444;' : 'background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);'}">
          <i data-lucide="${isError ? 'alert-triangle' : 'check'}" class="w-3 h-3"></i>
          <span>${isError ? 'Failed' : 'Completed'}</span>
        </span>
      </div>
      <details class="text-[10px] font-code pt-1 border-t theme-border">
        <summary class="cursor-pointer hover:text-[var(--text-main)] select-none flex items-center justify-between" style="color: var(--text-muted);">
          <span>Inspect output &amp; payload for <b>${escapeHtml(toolName)}</b></span>
          <span class="text-[9px] font-mono" style="color: var(--text-dim);">[expand]</span>
        </summary>
        <div class="mt-2 space-y-2">
          ${Object.keys(args).length > 0 ? `
            <div>
              <span class="font-sans font-bold" style="color: var(--text-dim);">Input:</span>
              <pre class="mt-0.5 p-2 rounded overflow-x-auto border font-code text-xs" style="background-color: var(--code-bg); border-color: var(--code-border); color: var(--text-muted);">${escapeHtml(JSON.stringify(args, null, 2))}</pre>
            </div>
          ` : ''}
          <div>
            <span class="font-sans font-bold" style="color: var(--text-dim);">Output:</span>
            <pre class="mt-0.5 p-2 rounded overflow-x-auto border font-code text-xs" style="background-color: var(--code-bg); border-color: var(--code-border); color: ${isError ? '#fca5a5' : 'var(--text-main)'};">${escapeHtml(typeof ev.result === 'object' ? JSON.stringify(ev.result, null, 2) : String(ev.result))}</pre>
          </div>
        </div>
      </details>
    </div>
  `;
}
