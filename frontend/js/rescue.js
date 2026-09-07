// =========================================================================
// 12. COGNITIVE RESCUE TRIGGER (2E / AH-SD calibrated rescue matrix)
// =========================================================================

import { API_BASE } from './state.js';
import { quickPrompt } from './ui-utils.js';

export async function triggerRescue(scenario) {
  try {
    const res = await fetch(`${API_BASE}/api/rescue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario })
    });
    const data = await res.json();
    closeRescueModal();
    quickPrompt(`[RESCUE TRIGGERED: ${scenario}] Diagnosis: ${data.realMechanism || "Blockage"}. Prescription: ${data.prescribedAction || "Physical action <2min"}`);
  } catch (err) {
    closeRescueModal();
  }
}

export function submitRamDump() {
  const text = document.getElementById('ram-dump-input').value.trim();
  if (text) {
    closeRescueModal();
    quickPrompt(`[RAM DUMP]: ${text}`);
  } else {
    closeRescueModal();
  }
}

export function openRescueModal() { document.getElementById('rescue-modal').classList.remove('hidden'); }
export function closeRescueModal() { document.getElementById('rescue-modal').classList.add('hidden'); }

// --- inline-handler surface (onclick="..." targets) ---
window.triggerRescue = triggerRescue;
window.submitRamDump = submitRamDump;
window.openRescueModal = openRescueModal;
window.closeRescueModal = closeRescueModal;
