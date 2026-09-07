// =========================================================================
// 14. QUICK INBOX CAPTURE HANDLERS (Cheat Sheet §7 & §8)
// =========================================================================

import { API_BASE } from './state.js';
import { loadWorkspaceData } from './workspace.js';

export function openQuickInboxModal() {
  document.getElementById('quick-inbox-modal').classList.remove('hidden');
  document.getElementById('quick-inbox-idea').value = '';
  document.getElementById('quick-inbox-reason').value = '';
  document.getElementById('quick-inbox-next').value = '';
  document.getElementById('quick-inbox-idea').focus();
}

export function closeQuickInboxModal() {
  document.getElementById('quick-inbox-modal').classList.add('hidden');
}

export async function handleQuickInboxSubmit(e) {
  e.preventDefault();
  const idea = document.getElementById('quick-inbox-idea').value.trim();
  const reason = document.getElementById('quick-inbox-reason').value.trim();
  const nextStep = document.getElementById('quick-inbox-next').value.trim();
  if (!idea) return;

  const submitBtn = document.getElementById('quick-inbox-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = "Salvando...";

  try {
    const res = await fetch(`${API_BASE}/api/inbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea, reason, nextStep })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    closeQuickInboxModal();
    loadWorkspaceData();
  } catch (err) {
    alert(`Error saving to Inbox: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i><span>Guardar no Inbox</span>`;
    lucide.createIcons();
  }
}

// --- inline-handler surface (onclick/onsubmit="..." targets) ---
window.openQuickInboxModal = openQuickInboxModal;
window.closeQuickInboxModal = closeQuickInboxModal;
window.handleQuickInboxSubmit = handleQuickInboxSubmit;
