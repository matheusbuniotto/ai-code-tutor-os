// =========================================================================
// 14. DYNAMIC CAPABILITY ARCS & JUDGMENT ENGINE
// 15. CURRICULUM ROADMAP (legacy adapter — one delegating function, kept here
//     rather than in a 6-line module of its own)
// =========================================================================

import { API_BASE, State } from './state.js';
import { escapeHtml } from './utils.js';
import { quickPrompt } from './ui-utils.js';
import { setSidebarTab } from './sidebar.js';

export async function loadArcsData() {
  const container = document.getElementById('arcs-tracks-container') || document.getElementById('curriculum-tracks-container');
  const progressPct = document.getElementById('arcs-progress-pct') || document.getElementById('curriculum-progress-pct');
  const progressBar = document.getElementById('arcs-progress-bar') || document.getElementById('curriculum-progress-bar');

  try {
    const res = await fetch(`${API_BASE}/api/arcs`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    State.cachedArcs = data.arcs || [];

    let totalCaps = 0;
    let doneCaps = 0;
    State.cachedArcs.forEach(a => {
      (a.capabilities || []).forEach(c => {
        totalCaps++;
        if (c.verified) doneCaps++;
      });
    });

    const pct = totalCaps > 0 ? Math.round((doneCaps / totalCaps) * 100) : 0;
    if (progressPct) progressPct.textContent = `${pct}% (${doneCaps}/${totalCaps})`;
    if (progressBar) progressBar.style.width = `${pct}%`;

    if (State.cachedArcs.length === 0) {
      if (container) {
        container.innerHTML = `
          <div class="p-4 text-center space-y-2">
            <div class="text-xs text-zinc-400">No capability arc configured yet.</div>
            <button onclick="openNewArcModal()" class="px-3 py-1.5 rounded-lg btn-primary text-xs font-bold shadow-sm">
              + Create My First Arc
            </button>
          </div>
        `;
      }
      return;
    }

    renderArcsList();
  } catch (err) {
    if (container) container.innerHTML = `<div class="p-3 text-red-400 text-xs">Error loading arcs: ${err.message}</div>`;
  }
}

export function renderArcsList() {
  const container = document.getElementById('arcs-tracks-container') || document.getElementById('curriculum-tracks-container');
  if (!container) return;

  container.innerHTML = State.cachedArcs.map((arc) => {
    const caps = arc.capabilities || [];
    const verifiedCount = caps.filter(c => c.verified).length;
    const colorClass = arc.color === 'sky' ? 'text-sky-400 bg-sky-500/10 border-sky-500/30' :
                       arc.color === 'purple' ? 'text-purple-400 bg-purple-500/10 border-purple-500/30' :
                       arc.color === 'amber' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                       'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

    return `
      <div class="rounded-xl theme-card border overflow-hidden shadow-sm space-y-2.5 p-3">
        <div class="flex items-start justify-between gap-2 border-b border-zinc-800/60 pb-2">
          <div class="space-y-1 flex-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="px-1.5 py-0.2 rounded text-[10px] font-bold border ${colorClass}">${escapeHtml(arc.id)}</span>
              <span class="font-bold text-xs text-zinc-100">${escapeHtml(arc.title)}</span>
            </div>
            <div class="text-[11px] text-zinc-400 leading-snug">${escapeHtml(arc.description)}</div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <span class="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">${verifiedCount}/${caps.length}</span>
            <button onclick="openEditArcModal('${escapeHtml(arc.id)}')" class="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer app-no-drag" data-tauri-drag-region="false" title="Edit Arc">
              <i data-lucide="edit-3" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>
            <button onclick="promptDeleteArc('${escapeHtml(arc.id)}')" class="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400 cursor-pointer app-no-drag" data-tauri-drag-region="false" title="Delete Arc">
              <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>
            <button onclick="promptAddCapability('${escapeHtml(arc.id)}')" class="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer app-no-drag" data-tauri-drag-region="false" title="Add Judgment Goal">
              <i data-lucide="plus" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>
          </div>
        </div>

        <!-- Capabilities List -->
        <div class="space-y-1.5">
          ${caps.map(cap => {
            const isDone = cap.verified;
            return `
              <div class="p-2 rounded-lg bg-zinc-950/50 hover:bg-zinc-900 border ${isDone ? 'border-emerald-500/40' : 'border-zinc-800'} transition-all flex flex-col gap-1 group">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5 flex-1 min-w-0">
                    <button onclick="toggleArcCapabilityVerified('${escapeHtml(arc.id)}', '${escapeHtml(cap.id)}', ${isDone})" title="${isDone ? 'Verified Goal' : 'Mark as Verified'}" class="shrink-0 cursor-pointer app-no-drag" data-tauri-drag-region="false">
                      <i data-lucide="${isDone ? 'check-circle-2' : 'circle'}" class="w-3.5 h-3.5 pointer-events-none ${isDone ? 'text-emerald-400 fill-emerald-500/20' : 'text-zinc-500 group-hover:text-zinc-400'}"></i>
                    </button>
                    <span class="text-xs text-zinc-200 font-medium leading-tight ${isDone ? 'text-emerald-300' : ''}">${escapeHtml(cap.title)}</span>
                  </div>

                  <div class="flex items-center gap-1 shrink-0">
                    <button onclick="generateAssignmentForCapability('${escapeHtml(arc.id)}', '${escapeHtml(cap.id)}', '${escapeHtml(cap.title)}')" title="Generate Engineering Challenge (Assigner)" class="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm cursor-pointer app-no-drag" data-tauri-drag-region="false">
                      <i data-lucide="zap" class="w-3 h-3 pointer-events-none"></i>
                      <span>Challenge</span>
                    </button>
                    <button onclick="removeCapability('${escapeHtml(arc.id)}', '${escapeHtml(cap.id)}')" class="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-red-400 transition-opacity cursor-pointer app-no-drag" data-tauri-drag-region="false" title="Remove Goal">
                      <i data-lucide="x" class="w-3 h-3 pointer-events-none"></i>
                    </button>
                  </div>
                </div>

                ${cap.evidence ? `
                  <div class="text-[10px] text-zinc-400 bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800/80 flex items-start gap-1 font-mono">
                    <span class="text-emerald-400 font-bold shrink-0">Evidence:</span>
                    <span class="truncate">${escapeHtml(cap.evidence)}</span>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

export async function toggleArcCapabilityVerified(arcId, capId, currentState) {
  if (currentState) {
    const arc = State.cachedArcs.find(a => a.id === arcId);
    if (arc) {
      const cap = arc.capabilities.find(c => c.id === capId);
      if (cap) {
        cap.verified = false;
        cap.evidence = "";
        await saveAllArcs();
      }
    }
  } else {
    const evidence = prompt(`Record the engineering evidence demonstrated for this goal:`, "Benchmark run with empirical evidence and the invariant demonstrated.");
    if (evidence === null) return;
    try {
      const res = await fetch(`${API_BASE}/api/arc/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arcId, capabilityId: capId, evidence })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      loadArcsData();
    } catch (err) {
      alert(`Error verifying capability: ${err.message}`);
    }
  }
}

export async function promptAddCapability(arcId) {
  const title = prompt("Enter the title of the new capability goal / technical judgment:");
  if (!title || !title.trim()) return;

  const arc = State.cachedArcs.find(a => a.id === arcId);
  if (!arc) return;

  const capId = `cap-${Date.now().toString(36)}`;
  arc.capabilities = arc.capabilities || [];
  arc.capabilities.push({
    id: capId,
    title: title.trim(),
    verified: false,
    evidence: "",
  });

  await saveAllArcs();
}

export async function removeCapability(arcId, capId) {
  const arc = State.cachedArcs.find(a => a.id === arcId);
  if (!arc) return;
  arc.capabilities = (arc.capabilities || []).filter(c => c.id !== capId);
  await saveAllArcs();
}

export function promptDeleteArc(arcId, fallbackTitle) {
  const arc = (State.cachedArcs || []).find(a => a.id === arcId);
  const arcTitle = arc?.title || fallbackTitle || arcId;
  State.pendingDeleteTarget = { type: 'arc', arcId, title: arcTitle };
  document.getElementById('delete-modal-title').textContent = "Delete Capability Arc";
  document.getElementById('delete-modal-desc').textContent = "Are you sure you want to permanently delete the following capability arc?";
  document.getElementById('delete-target-label').textContent = `Arc: "${arcTitle}" (${arcId})`;
  document.getElementById('delete-modal-subdesc').textContent = "All goals, challenges, and evidence linked to this arc will be permanently removed.";
  document.getElementById('delete-archive-option-btn').classList.add('hidden');
  document.getElementById('delete-confirm-modal').classList.remove('hidden');
  lucide.createIcons();
}

export async function deleteArc(arcId) {
  const arc = State.cachedArcs.find(a => a.id === arcId);
  promptDeleteArc(arcId, arc ? arc.title : arcId);
}

export function openEditArcModal(arcId) {
  const arc = State.cachedArcs.find(a => a.id === arcId);
  if (!arc) return;

  document.getElementById('new-arc-id').value = arc.id;
  document.getElementById('new-arc-id').readOnly = true;
  document.getElementById('new-arc-title').value = arc.title || '';
  document.getElementById('new-arc-desc').value = arc.description || '';
  document.getElementById('new-arc-color').value = arc.color || 'emerald';
  document.getElementById('new-arc-caps').value = (arc.capabilities || []).map(c => c.title).join('\n');
  document.getElementById('arc-modal-heading').textContent = `Edit Arc: ${arc.id}`;

  document.getElementById('arc-custom-modal').classList.remove('hidden');
}

export async function saveAllArcs() {
  try {
    const res = await fetch(`${API_BASE}/api/arcs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arcs: State.cachedArcs })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    loadArcsData();
  } catch (err) {
    alert(`Error saving arcs: ${err.message}`);
  }
}

export function generateAssignmentForCapability(arcId, capId, capTitle) {
  setSidebarTab('chat');
  quickPrompt(`[ASSIGNMENT REQUEST]\nArc: ${arcId}\nGoal: ${capTitle}\n\nGenerate a structured engineering challenge in the Predict ➔ Measure ➔ Mutate ➔ Explain protocol to exercise and expose this judgment gap.`);
}

export function openNewArcModal() {
  document.getElementById('new-arc-id').value = '';
  document.getElementById('new-arc-id').readOnly = false;
  document.getElementById('new-arc-title').value = '';
  document.getElementById('new-arc-desc').value = '';
  document.getElementById('new-arc-color').value = 'emerald';
  document.getElementById('new-arc-caps').value = '';
  document.getElementById('arc-modal-heading').textContent = 'Create New Capability Arc';
  document.getElementById('arc-custom-modal').classList.remove('hidden');
}
export function closeNewArcModal() {
  document.getElementById('arc-custom-modal').classList.add('hidden');
}

export async function handleCreateArcSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('new-arc-id').value.trim();
  const title = document.getElementById('new-arc-title').value.trim();
  const description = document.getElementById('new-arc-desc').value.trim();
  const color = document.getElementById('new-arc-color').value;
  const rawCaps = document.getElementById('new-arc-caps').value.trim();

  const existing = State.cachedArcs.find(a => a.id === id);
  const existingCapsMap = new Map((existing?.capabilities || []).map(c => [c.title, c]));

  const capabilities = rawCaps.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((t, idx) => {
      if (existingCapsMap.has(t)) {
        return existingCapsMap.get(t);
      }
      return {
        id: `cap-${idx + 1}-${Date.now().toString(36)}`,
        title: t,
        verified: false,
        evidence: ""
      };
    });

  try {
    const res = await fetch(`${API_BASE}/api/arc/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        arc: { id, title, description, color, capabilities, status: "in_progress", linkedProjects: existing?.linkedProjects || [] }
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    closeNewArcModal();
    loadArcsData();
  } catch (err) {
    alert(`Error saving arc: ${err.message}`);
  }
}

// 15. Curriculum roadmap & project starter engine (legacy adapted)
export async function loadCurriculumData() {
  await loadArcsData();
}

// --- inline-handler surface (onclick/onsubmit="..." targets) ---
window.loadArcsData = loadArcsData;
window.toggleArcCapabilityVerified = toggleArcCapabilityVerified;
window.promptAddCapability = promptAddCapability;
window.removeCapability = removeCapability;
window.promptDeleteArc = promptDeleteArc;
window.deleteArc = deleteArc;
window.openEditArcModal = openEditArcModal;
window.generateAssignmentForCapability = generateAssignmentForCapability;
window.openNewArcModal = openNewArcModal;
window.closeNewArcModal = closeNewArcModal;
window.handleCreateArcSubmit = handleCreateArcSubmit;
window.loadCurriculumData = loadCurriculumData;
