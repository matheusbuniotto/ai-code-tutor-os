// =========================================================================
// SHARED DELETE / ARCHIVE CONFIRMATION MODAL DISPATCHER
// =========================================================================
// The `prompt*` functions that *open* this modal stay in their own domain
// modules (they only fill in DOM text + State.pendingDeleteTarget). This
// module owns the one place that reads pendingDeleteTarget and fans out to
// every domain's delete endpoint — genuinely cross-cutting, so it lives on
// its own instead of being buried inside workspace.js as it used to be.

import { API_BASE, State } from './state.js';
import { loadThreadsList, switchThread } from './threads.js';
import { loadArcsData } from './arcs.js';
import { loadMemoryData } from './memory.js';
import { closeFileModal, executeArchive, loadWorkspaceData } from './workspace.js';

export async function executeArchiveFromModal() {
  if (!State.pendingDeleteTarget.slug) return;
  const slug = State.pendingDeleteTarget.slug;
  closeDeleteConfirmModal();
  await executeArchive(slug, "archive");
}

export async function executePendingDelete() {
  const btn = document.getElementById('delete-confirm-action-btn');
  btn.disabled = true;
  btn.textContent = "Excluindo...";

  try {
    if (State.pendingDeleteTarget.type === 'thread') {
      const threadId = State.pendingDeleteTarget.threadId;
      const res = await fetch(`${API_BASE}/api/thread/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (State.activeThreadId === threadId) {
        State.activeThreadId = 'session-principal';
        localStorage.setItem('tutor_active_thread', State.activeThreadId);
      }
      closeDeleteConfirmModal();
      await loadThreadsList();
      switchThread(State.activeThreadId);
      return;
    }

    if (State.pendingDeleteTarget.type === 'arc') {
      const arcId = State.pendingDeleteTarget.arcId;
      const res = await fetch(`${API_BASE}/api/arc/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arcId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeDeleteConfirmModal();
      await loadArcsData();
      return;
    }

    if (State.pendingDeleteTarget.type === 'evidence') {
      const id = State.pendingDeleteTarget.id;
      const res = await fetch(`${API_BASE}/api/memory/evidence/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeDeleteConfirmModal();
      await loadMemoryData();
      return;
    }

    if (State.pendingDeleteTarget.type === 'observation') {
      const index = State.pendingDeleteTarget.index;
      const res = await fetch(`${API_BASE}/api/memory/observation/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeDeleteConfirmModal();
      await loadMemoryData();
      return;
    }

    if (State.pendingDeleteTarget.type === 'episode') {
      const { index, date, projectSlug, topic } = State.pendingDeleteTarget;
      const res = await fetch(`${API_BASE}/api/memory/episode/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, date, projectSlug, topic })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeDeleteConfirmModal();
      await loadMemoryData();
      return;
    }

    if (State.pendingDeleteTarget.type === 'episodes-clear') {
      const res = await fetch(`${API_BASE}/api/memory/episodes/clear`, {
        method: "POST"
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeDeleteConfirmModal();
      await loadMemoryData();
      return;
    }

    if (State.pendingDeleteTarget.type === 'experiment') {
      const id = State.pendingDeleteTarget.id;
      const res = await fetch(`${API_BASE}/api/experiments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeDeleteConfirmModal();
      await loadMemoryData();
      return;
    }

    const res = await fetch(`${API_BASE}/api/workspace/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: State.pendingDeleteTarget.slug || undefined,
        path: State.pendingDeleteTarget.path || undefined,
        isArchived: State.pendingDeleteTarget.isArchived
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    closeDeleteConfirmModal();
    closeFileModal();
    loadWorkspaceData();
  } catch (err) {
    alert(`Erro ao excluir: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i><span>Excluir</span>`;
    lucide.createIcons();
  }
}

export function closeDeleteConfirmModal() {
  document.getElementById('delete-confirm-modal').classList.add('hidden');
  State.pendingDeleteTarget = { type: null, slug: null, path: null, isArchived: false };
}

// --- inline-handler surface (onclick="..." targets) ---
window.executeArchiveFromModal = executeArchiveFromModal;
window.executePendingDelete = executePendingDelete;
window.closeDeleteConfirmModal = closeDeleteConfirmModal;
