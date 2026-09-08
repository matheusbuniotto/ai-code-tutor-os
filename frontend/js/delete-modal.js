// =========================================================================
// SHARED DELETE / ARCHIVE / RESET CONFIRMATION MODAL DISPATCHER
// =========================================================================
// The `prompt*` functions that *open* this modal stay in their own domain
// modules (they only fill in DOM text + State.pendingDeleteTarget). This
// module owns the one place that reads pendingDeleteTarget and fans out to
// every domain's delete/reset endpoint — genuinely cross-cutting, so it lives on
// its own instead of being buried inside workspace.js as it used to be.

import { API_BASE, State } from './state.js';
import { clearOnboardingDismissed } from './onboarding.js';
import { createNewThread, loadThreadsList, switchThread } from './threads.js';
import { loadArcsData } from './arcs.js';
import { loadMemoryData } from './memory.js';
import { closeFileModal, executeArchive, loadWorkspaceData } from './workspace.js';

export async function executeArchiveFromModal() {
  if (!State.pendingDeleteTarget.slug) return;
  const slug = State.pendingDeleteTarget.slug;
  closeDeleteConfirmModal();
  closeFileModal();
  await executeArchive(slug, "archive");
}

export async function executePendingDelete() {
  const btn = document.getElementById('delete-confirm-action-btn');
  btn.disabled = true;
  const targetType = State.pendingDeleteTarget?.type;
  const isReset = targetType === 'workspace-reset';
  const isImport = targetType === 'workspace-import';
  const isPurge = targetType === 'memory-purge';
  const isClear = targetType === 'thread-clear' || targetType === 'episodes-clear';
  btn.textContent = isReset ? "Resetting..." : isImport ? "Importing..." : isPurge ? "Purging..." : isClear ? "Clearing..." : "Deleting...";

  const errEl = document.getElementById('delete-modal-error');
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.add('hidden');
  }

  try {
    if (targetType === 'workspace-reset') {
      const res = await fetch(`${API_BASE}/api/workspace/reset`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.reason || 'Reset failed on backend');
      localStorage.removeItem('tutor_active_thread');
      localStorage.removeItem('tutor_tree_collapsed');
      clearOnboardingDismissed();
      closeDeleteConfirmModal();
      window.location.reload();
      return;
    }

    if (targetType === 'workspace-import') {
      const file = State.pendingDeleteTarget.file;
      if (!file) throw new Error("No backup archive selected");
      const res = await fetch(`${API_BASE}/api/workspace/import`, {
        method: "POST",
        headers: { "Content-Type": "application/zip" },
        body: await file.arrayBuffer(),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.reason || 'Import failed on backend');
      localStorage.removeItem('tutor_active_thread');
      localStorage.removeItem('tutor_tree_collapsed');
      clearOnboardingDismissed();
      closeDeleteConfirmModal();
      window.location.reload();
      return;
    }

    if (targetType === 'thread-clear') {
      const threadId = State.pendingDeleteTarget.threadId;
      const res = await fetch(`${API_BASE}/api/thread/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeDeleteConfirmModal();
      await switchThread(threadId);
      await loadThreadsList();
      return;
    }

    if (targetType === 'memory-purge') {
      const res = await fetch(`${API_BASE}/api/memory/purge`, {
        method: "POST"
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeDeleteConfirmModal();
      localStorage.removeItem('tutor_active_thread');
      const messagesContainer = document.getElementById('messages-container');
      if (messagesContainer) {
        messagesContainer.innerHTML = '';
      }
      await createNewThread();
      await Promise.all([loadMemoryData(), loadArcsData(), loadThreadsList()]);
      const statusEl = document.getElementById('workspace-data-status');
      if (statusEl) {
        statusEl.textContent = '✓ Memory purged clean';
        statusEl.classList.remove('hidden', 'text-red-400');
        statusEl.classList.add('text-emerald-400');
        setTimeout(() => statusEl.classList.add('hidden'), 5000);
      }
      return;
    }

    if (targetType === 'thread') {
      const threadId = State.pendingDeleteTarget.threadId;
      const res = await fetch(`${API_BASE}/api/thread/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeDeleteConfirmModal();
      await loadThreadsList();
      if (State.activeThreadId === threadId) {
        const remaining = (State.cachedThreads || []).find(t => t.id !== threadId);
        const nextThreadId = remaining ? remaining.id : 'session-principal';
        switchThread(nextThreadId);
      }
      return;
    }

    if (targetType === 'arc') {
      const arcId = State.pendingDeleteTarget.arcId;
      const res = await fetch(`${API_BASE}/api/arc/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arcId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeDeleteConfirmModal();
      await Promise.all([loadArcsData(), loadMemoryData()]);
      return;
    }

    if (targetType === 'evidence') {
      const id = State.pendingDeleteTarget.id;
      const res = await fetch(`${API_BASE}/api/memory/evidence/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeDeleteConfirmModal();
      await Promise.all([loadMemoryData(), loadArcsData()]);
      return;
    }

    if (targetType === 'observation') {
      const { index, tag, text } = State.pendingDeleteTarget;
      const res = await fetch(`${API_BASE}/api/memory/observation/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, tag, text })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeDeleteConfirmModal();
      await loadMemoryData();
      return;
    }

    if (targetType === 'episode') {
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

    if (targetType === 'episodes-clear') {
      const res = await fetch(`${API_BASE}/api/memory/episodes/clear`, {
        method: "POST"
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeDeleteConfirmModal();
      await loadMemoryData();
      return;
    }

    if (targetType === 'experiment') {
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

    if (targetType === 'file' || targetType === 'project') {
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
      await loadWorkspaceData();
      return;
    }

    closeDeleteConfirmModal();
  } catch (err) {
    if (errEl) {
      errEl.textContent = `Error: ${err.message}`;
      errEl.classList.remove('hidden');
    } else {
      console.error('Delete execution error:', err);
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i><span>Delete</span>`;
    lucide.createIcons();
  }
}

export function closeDeleteConfirmModal() {
  const modal = document.getElementById('delete-confirm-modal');
  if (modal) modal.classList.add('hidden');
  const deleteBtn = document.getElementById('delete-confirm-action-btn');
  const archiveBtn = document.getElementById('delete-archive-option-btn');
  const errEl = document.getElementById('delete-modal-error');
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.add('hidden');
  }
  if (deleteBtn) {
    deleteBtn.classList.remove('hidden');
    deleteBtn.innerHTML = `<i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i><span>Delete</span>`;
  }
  if (archiveBtn) archiveBtn.classList.add('hidden');
  const importInput = document.getElementById('workspace-import-input');
  if (importInput) importInput.value = '';
  State.pendingDeleteTarget = { type: null, slug: null, path: null, isArchived: false };
}

// --- inline-handler surface (onclick="..." targets) ---
window.executeArchiveFromModal = executeArchiveFromModal;
window.executePendingDelete = executePendingDelete;
window.closeDeleteConfirmModal = closeDeleteConfirmModal;
