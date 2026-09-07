// =========================================================================
// 7. SESSIONS & THREADS (sidebar list, switching, rename/export/clear)
// =========================================================================
// Split out of the old section 7+8 blob: this half owns the *session list*
// and loading a thread's history. The live message stream lives in chat.js.

import { API_BASE, State } from './state.js';
import { escapeHtml, formatRelativeTime, getDateGroup } from './utils.js';
import { renderMarkdown } from './markdown.js';
import { scrollToBottom } from './ui-utils.js';
import {
  AGENT_META,
  AGENT_IDLE_LABEL,
  buildToolEventCardHTML,
  updateConductorBadge,
} from './agents.js';
import { setSidebarTab } from './sidebar.js';
import { buildUserMessageBlock } from './chat.js';

// -------------------------------------------------------------------------
// 3.5 Agent Switcher Handler
// Switching the active agent starts a fresh session scoped to it, rather
// than mixing a different agent identity into an existing thread's history.
// -------------------------------------------------------------------------
export function onAgentChanged() {
  const select = document.getElementById('agent-selector');
  if (!select) return;
  const agentId = select.value;
  updateConductorBadge(AGENT_IDLE_LABEL[agentId] || AGENT_IDLE_LABEL.tutor, false);
  createNewThread(agentId);
}

export function toggleNowCard() {
  State.nowCardCollapsed = !State.nowCardCollapsed;
  const card = document.getElementById('quick-now-card');
  const chevron = document.getElementById('now-card-chevron');
  if (State.nowCardCollapsed) {
    card.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(-90deg)';
  } else {
    card.style.display = '';
    if (chevron) chevron.style.transform = '';
  }
}

export function handleThreadSearch(val) {
  State.threadSearchQuery = (val || '').toLowerCase().trim();
  const clearBtn = document.getElementById('thread-search-clear');
  if (clearBtn) {
    if (State.threadSearchQuery) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  loadThreadsList();
}

export function clearThreadSearch() {
  const input = document.getElementById('thread-search-input');
  if (input) input.value = '';
  handleThreadSearch('');
}

export async function renameThread(threadId, currentTitle) {
  const newTitle = prompt('Rename session:', currentTitle);
  if (!newTitle || newTitle === currentTitle) return;
  try {
    await fetch(`${API_BASE}/api/thread/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, title: newTitle }),
    });
    loadThreadsList();
    if (threadId === State.activeThreadId) {
      const el = document.getElementById('active-thread-title-text');
      if (el) el.textContent = newTitle;
    }
  } catch (e) { console.error('rename error', e); }
}

export function promptRenameActiveThread() {
  if (!State.activeThreadId) return;
  const el = document.getElementById('active-thread-title-text');
  const current = el ? el.textContent : 'Session';
  renameThread(State.activeThreadId, current);
}

export async function exportCurrentThreadMarkdown() {
  if (!State.activeThreadId) return;
  try {
    const res = await fetch(`${API_BASE}/api/thread/export?threadId=${encodeURIComponent(State.activeThreadId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tutor-session-${State.activeThreadId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Error exporting conversation: ${err.message}`);
  }
}

export async function copyCurrentThreadTranscript() {
  if (!State.activeThreadId) return;
  try {
    const res = await fetch(`${API_BASE}/api/thread/export?threadId=${encodeURIComponent(State.activeThreadId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    const btnSpan = document.querySelector('[onclick="copyCurrentThreadTranscript()"] span');
    if (btnSpan) {
      const orig = btnSpan.textContent;
      btnSpan.textContent = 'Copied! ✓';
      setTimeout(() => btnSpan.textContent = orig, 1800);
    }
  } catch (err) {
    alert(`Error copying conversation: ${err.message}`);
  }
}

export async function promptClearActiveThread() {
  if (!State.activeThreadId) return;
  if (!confirm('Clear all messages in this session while keeping the active topic?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/thread/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: State.activeThreadId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await switchThread(State.activeThreadId);
    await loadThreadsList();
  } catch (err) {
    alert(`Error clearing conversation: ${err.message}`);
  }
}

export async function loadThreadsList() {
  const container = document.getElementById('threads-list');
  const pillsContainer = document.getElementById('agent-filter-pills');
  try {
    const res = await fetch(`${API_BASE}/api/threads`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    let threads = data.threads || [];

    if (threads.length === 0) {
      container.innerHTML = `<div class="text-[11px] text-zinc-500 p-2">No sessions recorded.</div>`;
      return;
    }

    if (!threads.find(t => t.id === State.activeThreadId)) {
      State.activeThreadId = threads[0].id;
      localStorage.setItem('tutor_active_thread', State.activeThreadId);
    }

    // Build agent filter pills
    const agentIds = [...new Set(threads.map(t => t.metadata?.agentId).filter(Boolean))];
    if (pillsContainer && agentIds.length > 1) {
      pillsContainer.innerHTML = agentIds.map(aid => {
        const meta = AGENT_META[aid] || { label: aid, color: 'zinc' };
        const isActive = State.activeAgentFilter === aid;
        const c = meta.color;
        return `<button onclick="toggleAgentFilter('${aid}')" class="text-[9px] px-1.5 py-0.5 rounded-full border font-mono font-bold transition-all cursor-pointer app-no-drag ${isActive ? `bg-${c}-500 text-black border-${c}-400` : `bg-${c}-950/60 text-${c}-300 border-${c}-800 hover:bg-${c}-900`}">${meta.label}</button>`;
      }).join('');
      lucide.createIcons();
    } else if (pillsContainer) {
      pillsContainer.innerHTML = '';
    }

    // Apply agent filter
    if (State.activeAgentFilter) {
      threads = threads.filter(t => (t.metadata?.agentId || 'tutor') === State.activeAgentFilter);
    }

    // Apply search query filter
    if (State.threadSearchQuery) {
      threads = threads.filter(t => {
        const title = (t.title || '').toLowerCase();
        const aid = (t.metadata?.agentId || '').toLowerCase();
        return title.includes(State.threadSearchQuery) || aid.includes(State.threadSearchQuery);
      });
    }

    if (threads.length === 0) {
      container.innerHTML = `<div class="text-[11px] text-zinc-500 p-3 text-center">No sessions found for "${escapeHtml(State.threadSearchQuery)}".</div>`;
      return;
    }

    // Group by date
    const groups = {};
    const groupOrder = ['Today', 'Yesterday', 'This week', 'Older'];
    threads.forEach(t => {
      const g = getDateGroup(t.updatedAt || t.createdAt);
      if (!groups[g]) groups[g] = [];
      groups[g].push(t);
    });

    let html = '';
    groupOrder.forEach(group => {
      if (!groups[group]) return;
      html += `<div class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1 pt-2 pb-0.5 select-none">${group}</div>`;
      groups[group].forEach(t => {
        const isActive = t.id === State.activeThreadId;
        const agentId = t.metadata?.agentId || 'tutor';
        const meta = AGENT_META[agentId] || { label: agentId, color: 'zinc' };
        const displayTitle = escapeHtml(t.title || 'Session');
        const safeId = escapeHtml(t.id);
        const msgCount = t.messageCount || 0;
        const timeAgo = formatRelativeTime(t.updatedAt || t.createdAt);

        html += `
          <div data-thread-id="${safeId}"
               data-thread-title="${displayTitle}"
               title="Click to open conversation / Double-click to rename"
               class="p-2 rounded-lg ${isActive
                 ? 'theme-card border theme-border font-semibold shadow-sm text-zinc-100 ring-1 ring-[var(--accent)]/30'
                 : 'bg-transparent hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-transparent'
               } flex items-center justify-between cursor-pointer transition-all group app-no-drag select-none"
               data-tauri-drag-region="false">
            <div class="flex items-center gap-2 truncate flex-1 min-w-0 pr-1 pointer-events-none">
              <span class="w-2 h-2 rounded-full ${isActive ? 'theme-bg-accent ring-2 ring-[var(--accent)]/30' : 'bg-zinc-600'} shrink-0"></span>
              <div class="truncate flex-1 min-w-0">
                <div class="truncate text-xs font-sans leading-tight">${displayTitle}</div>
                <div class="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 mt-0.5">
                  <span>${msgCount} ${msgCount === 1 ? 'msg' : 'msgs'}</span>
                  ${timeAgo ? `<span>• ${timeAgo}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button data-action="rename-thread"
                      data-thread-id="${safeId}"
                      data-thread-title="${displayTitle}"
                      title="Rename Session"
                      class="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer app-no-drag"
                      data-tauri-drag-region="false">
                <i data-lucide="edit-2" class="w-3.5 h-3.5 pointer-events-none"></i>
              </button>
              <button data-action="export-thread"
                      data-thread-id="${safeId}"
                      title="Export Markdown"
                      class="p-1 text-zinc-400 hover:text-[var(--accent)] hover:bg-zinc-800 rounded transition-colors cursor-pointer app-no-drag"
                      data-tauri-drag-region="false">
                <i data-lucide="download" class="w-3.5 h-3.5 pointer-events-none"></i>
              </button>
              <button data-action="delete-thread"
                      data-thread-id="${safeId}"
                      data-thread-title="${displayTitle}"
                      title="Delete Session"
                      class="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer app-no-drag"
                      data-tauri-drag-region="false">
                <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
              </button>
            </div>
          </div>
        `;
      });
    });

    container.innerHTML = html;
    lucide.createIcons();
  } catch (err) {
    console.error('Threads load error:', err);
    if (container) {
      container.innerHTML = `
        <div class="p-3 text-center space-y-2">
          <div class="text-xs text-amber-400">Backend server connecting...</div>
          <button onclick="loadThreadsList()" class="text-[10px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border theme-border cursor-pointer">Reconnect</button>
        </div>
      `;
    }
  }
}

export function toggleAgentFilter(agentId) {
  State.activeAgentFilter = (State.activeAgentFilter === agentId) ? null : agentId;
  loadThreadsList();
}

export async function switchThread(threadId) {
  if (!threadId) return;
  State.activeThreadId = threadId;
  localStorage.setItem('tutor_active_thread', State.activeThreadId);
  setSidebarTab('chat');
  loadThreadsList();

  const titleEl = document.getElementById('active-thread-title-text');
  const countEl = document.getElementById('active-thread-msg-count');

  const messagesContainer = document.getElementById('messages-container');
  messagesContainer.innerHTML = `
    <div class="p-4 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
      <i data-lucide="loader-2" class="w-4 h-4 animate-spin theme-accent"></i>
      <span>Loading conversation history...</span>
    </div>
  `;
  lucide.createIcons();

  try {
    const res = await fetch(`${API_BASE}/api/thread/messages?threadId=${encodeURIComponent(threadId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const messages = data.messages || [];
    const threadAgentId = data.agentId || 'tutor';
    const agentSelect = document.getElementById('agent-selector');
    if (agentSelect && AGENT_IDLE_LABEL[threadAgentId]) {
      agentSelect.value = threadAgentId;
      updateConductorBadge(AGENT_IDLE_LABEL[threadAgentId], false);
    }
    const agentLabel = (AGENT_META[threadAgentId]?.label || 'Tutor').toUpperCase();
    const toolEventsByMessageId = {};
    (data.toolEvents || []).forEach(ev => {
      if (!ev.messageId) return;
      (toolEventsByMessageId[ev.messageId] = toolEventsByMessageId[ev.messageId] || []).push(ev);
    });

    if (countEl) countEl.textContent = `• ${messages.length} ${messages.length === 1 ? 'msg' : 'msgs'}`;

    if (messages.length === 0) {
      if (titleEl) titleEl.textContent = "New Session";
      messagesContainer.innerHTML = `
        <div class="flex items-start gap-3.5">
          <div class="w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5" style="background-color: var(--accent); color: var(--accent-text); box-shadow: 0 2px 8px var(--accent-subtle);">
            ✦
          </div>
          <div class="flex-1 space-y-2">
            <div class="font-semibold text-sm text-zinc-200">Tutor Navigator</div>
            <div class="text-base text-zinc-300 leading-relaxed prose-chat">
              <p>Active session started. Send a message to move forward on the project or capability arcs.</p>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Set title from first user message or thread list
    const firstUser = messages.find(m => m.role === 'user');
    if (firstUser && titleEl) {
      const autoTitle = firstUser.text.slice(0, 36).replace(/[\r\n]+/g, ' ') + (firstUser.text.length > 36 ? '...' : '');
      titleEl.textContent = autoTitle;
    }

    messagesContainer.innerHTML = '';
    messages.forEach(m => {
      if (m.role === 'user') {
        messagesContainer.appendChild(buildUserMessageBlock(m.id || '', m.text || ''));
      } else {
        const bubbleId = `hist-bubble-${m.id || Math.random().toString(36).slice(2, 7)}`;
        const toolEvents = (m.id && toolEventsByMessageId[m.id]) || [];
        const stepsHtml = toolEvents.map(buildToolEventCardHTML).join('');
        const assistantBlock = document.createElement('div');
        assistantBlock.className = "flex items-start gap-3.5";
        assistantBlock.innerHTML = `
          <div class="w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5" style="background-color: var(--accent); color: var(--accent-text); box-shadow: 0 2px 8px var(--accent-subtle);">
            ✦
          </div>
          <div class="flex-1 space-y-2 max-w-2xl">
            <div class="font-semibold text-sm text-zinc-200 flex items-center gap-2">
              <span>${escapeHtml(agentLabel)}</span>
              <span class="text-xs text-zinc-500 font-normal">deepseek-v4-flash</span>
            </div>
            ${stepsHtml ? `<div class="space-y-1.5">${stepsHtml}</div>` : ''}
            <div id="${bubbleId}" class="text-base text-zinc-300 leading-relaxed prose-chat font-sans">
              ${renderMarkdown(m.text || '')}
            </div>
            <div class="flex items-center gap-3 pt-1 text-xs text-zinc-500">
              <button onclick="copyMessageText('${bubbleId}', this)" class="hover:text-zinc-300 flex items-center gap-1 cursor-pointer">
                <i data-lucide="copy" class="w-3.5 h-3.5 pointer-events-none"></i>
                <span>Copy</span>
              </button>
            </div>
          </div>
        `;
        messagesContainer.appendChild(assistantBlock);
      }
    });

    lucide.createIcons();
    scrollToBottom();
  } catch (err) {
    messagesContainer.innerHTML = `
      <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center space-y-2 max-w-md mx-auto my-8">
        <div class="text-xs text-amber-400 font-semibold">Could not connect to the server</div>
        <div class="text-[11px] text-zinc-400">Check that the backend is running at <code>http://localhost:4115</code></div>
        <button onclick="switchThread('${threadId}')" class="mt-2 text-xs px-3 py-1.5 rounded-lg theme-card theme-accent border theme-border font-semibold cursor-pointer">Try Again</button>
      </div>
    `;
  }
}

export async function createNewThread(agentId) {
  const threadId = `thread-${Date.now()}`;
  const label = AGENT_META[agentId]?.label;
  try {
    const res = await fetch(`${API_BASE}/api/thread/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId,
        title: label ? `New ${label} Session` : "New Session",
        agentId: agentId || undefined,
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    State.activeThreadId = threadId;
    localStorage.setItem('tutor_active_thread', State.activeThreadId);
    await loadThreadsList();
    switchThread(threadId);
  } catch (err) {
    alert(`Error creating new chat: ${err.message}`);
  }
}

export function promptDeleteThread(threadId, threadTitle) {
  State.pendingDeleteTarget = { type: 'thread', threadId, title: threadTitle };
  document.getElementById('delete-modal-title').textContent = "Delete Chat Session";
  document.getElementById('delete-modal-desc').textContent = "Are you sure you want to delete this conversation?";
  document.getElementById('delete-target-label').textContent = `Session: "${threadTitle || threadId}"`;
  document.getElementById('delete-modal-subdesc').textContent = "All message history for this session will be permanently removed from the database.";
  document.getElementById('delete-archive-option-btn').classList.add('hidden');
  document.getElementById('delete-confirm-modal').classList.remove('hidden');
  lucide.createIcons();
}

export async function deleteThread(threadId) {
  promptDeleteThread(threadId, threadId);
}

// =========================================================================
// Centralized Event Delegation for Threads List (Click & DblClick)
// =========================================================================
const threadsListEl = document.getElementById('threads-list');
if (threadsListEl) {
  threadsListEl.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('[data-action="delete-thread"]');
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const threadId = deleteBtn.getAttribute('data-thread-id');
      const threadTitle = deleteBtn.getAttribute('data-thread-title') || threadId;
      promptDeleteThread(threadId, threadTitle);
      return;
    }

    const renameBtn = e.target.closest('[data-action="rename-thread"]');
    if (renameBtn) {
      e.preventDefault();
      e.stopPropagation();
      const threadId = renameBtn.getAttribute('data-thread-id');
      const threadTitle = renameBtn.getAttribute('data-thread-title') || '';
      renameThread(threadId, threadTitle);
      return;
    }

    const exportBtn = e.target.closest('[data-action="export-thread"]');
    if (exportBtn) {
      e.preventDefault();
      e.stopPropagation();
      const threadId = exportBtn.getAttribute('data-thread-id');
      if (threadId) {
        window.open(`${API_BASE}/api/thread/export?threadId=${encodeURIComponent(threadId)}`, '_blank');
      }
      return;
    }

    const threadItem = e.target.closest('[data-thread-id]');
    if (threadItem) {
      e.preventDefault();
      e.stopPropagation();
      const threadId = threadItem.getAttribute('data-thread-id');
      if (threadId) {
        switchThread(threadId);
      }
    }
  });

  threadsListEl.addEventListener('dblclick', (e) => {
    const threadItem = e.target.closest('[data-thread-id]');
    if (threadItem && !e.target.closest('[data-action]')) {
      e.preventDefault();
      e.stopPropagation();
      const threadId = threadItem.getAttribute('data-thread-id');
      const threadTitle = threadItem.getAttribute('data-thread-title') || '';
      renameThread(threadId, threadTitle);
    }
  });
}

// --- inline-handler surface (onclick/onchange/oninput="..." targets) ---
window.onAgentChanged = onAgentChanged;
window.toggleNowCard = toggleNowCard;
window.handleThreadSearch = handleThreadSearch;
window.clearThreadSearch = clearThreadSearch;
window.renameThread = renameThread;
window.promptRenameActiveThread = promptRenameActiveThread;
window.exportCurrentThreadMarkdown = exportCurrentThreadMarkdown;
window.copyCurrentThreadTranscript = copyCurrentThreadTranscript;
window.promptClearActiveThread = promptClearActiveThread;
window.loadThreadsList = loadThreadsList;
window.toggleAgentFilter = toggleAgentFilter;
window.switchThread = switchThread;
window.createNewThread = createNewThread;
window.promptDeleteThread = promptDeleteThread;
window.deleteThread = deleteThread;
