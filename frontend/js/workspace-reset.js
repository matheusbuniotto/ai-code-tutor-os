// =========================================================================
// WORKSPACE DATA — export / import / reset (Settings modal, "Workspace Data")
// =========================================================================

import { API_BASE, State } from './state.js';

export async function exportWorkspaceBackup() {
  const statusEl = document.getElementById('workspace-data-status');
  try {
    const res = await fetch(`${API_BASE}/api/workspace/export`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const backupPath = res.headers.get('X-Backup-Path') || 'workspace/_backups/';
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tutor-os-workspace-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    if (statusEl) {
      statusEl.textContent = `✓ Exported (${backupPath})`;
      statusEl.classList.remove('hidden', 'text-red-400');
      statusEl.classList.add('text-emerald-400');
      setTimeout(() => statusEl.classList.add('hidden'), 6000);
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = `Export failed: ${err.message}`;
      statusEl.classList.remove('hidden', 'text-emerald-400');
      statusEl.classList.add('text-red-400');
      setTimeout(() => statusEl.classList.add('hidden'), 6000);
    }
  }
}

export function promptImportWorkspace(file) {
  if (!file) return;
  State.pendingDeleteTarget = { type: 'workspace-import', file };
  document.getElementById('delete-modal-title').textContent = "Import Workspace Backup";
  document.getElementById('delete-modal-desc').textContent = "Are you sure you want to replace your workspace with this backup?";
  document.getElementById('delete-target-label').textContent = `Backup: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  document.getElementById('delete-modal-subdesc').textContent = "Your CURRENT workspace will first be backed up to workspace/_backups/, then replaced entirely. Old chat threads will be cleared to prevent data leakage, and the app will reload.";
  document.getElementById('delete-archive-option-btn').classList.add('hidden');
  const actionBtn = document.getElementById('delete-confirm-action-btn');
  actionBtn.classList.remove('hidden');
  actionBtn.innerHTML = `<i data-lucide="upload" class="w-3.5 h-3.5 pointer-events-none"></i><span>Import &amp; Reload</span>`;
  document.getElementById('delete-confirm-modal').classList.remove('hidden');
  lucide.createIcons();
}

export function promptResetWorkspace() {
  State.pendingDeleteTarget = { type: 'workspace-reset' };
  document.getElementById('delete-modal-title').textContent = "Reset Workspace Data";
  document.getElementById('delete-modal-desc').textContent = "Are you sure you want to reset the workspace to a blank onboarding state?";
  document.getElementById('delete-target-label').textContent = "Current profile, capability arcs, memory episodes, and projects";
  document.getElementById('delete-modal-subdesc').textContent = "A backup will automatically be saved to workspace/_backups/ first. All local database chat threads will be cleared to prevent data leakage, and the app will reload.";
  document.getElementById('delete-archive-option-btn').classList.add('hidden');
  const actionBtn = document.getElementById('delete-confirm-action-btn');
  actionBtn.classList.remove('hidden');
  actionBtn.innerHTML = `<i data-lucide="rotate-ccw" class="w-3.5 h-3.5 pointer-events-none"></i><span>Reset Workspace</span>`;
  document.getElementById('delete-confirm-modal').classList.remove('hidden');
  lucide.createIcons();
}

export function importWorkspaceBackup(file) {
  promptImportWorkspace(file);
}

export function resetWorkspaceData() {
  promptResetWorkspace();
}

window.exportWorkspaceBackup = exportWorkspaceBackup;
window.importWorkspaceBackup = importWorkspaceBackup;
window.resetWorkspaceData = resetWorkspaceData;
window.promptResetWorkspace = promptResetWorkspace;
window.promptImportWorkspace = promptImportWorkspace;
