// =========================================================================
// 10. MEMORY, AUDIT GRAPH (L1 -> L2 -> L3) & OBSERVATIONS ENGINE
//     + evidence / observation / episode / experiment / purge handlers
// =========================================================================

import { API_BASE, State } from './state.js';
import { escapeHtml } from './utils.js';
import { createNewThread, loadThreadsList } from './threads.js';

export function setMemoryFilter(filter) {
  State.activeMemoryFilter = filter;
  renderMemoryContent();
}

export async function loadMemoryData() {
  const container = document.getElementById('memory-content-area');
  try {
    const [graphRes, memRes, expRes] = await Promise.all([
      fetch(`${API_BASE}/api/memory/graph`).catch(() => null),
      fetch(`${API_BASE}/api/memory`).catch(() => null),
      fetch(`${API_BASE}/api/experiments`).catch(() => null)
    ]);

    State.cachedMemoryGraph = graphRes && graphRes.ok ? await graphRes.json() : null;
    State.cachedMemoryData = memRes && memRes.ok ? await memRes.json() : { observations: [], episodes: [], totalNotes: 0, library: [] };
    State.cachedExpData = expRes && expRes.ok ? await expRes.json() : { experiments: [] };

    renderMemoryContent();
  } catch (err) {
    container.innerHTML = `<div class="p-2 text-red-400 text-xs">Error loading memory: ${err.message}</div>`;
  }
}

export function renderMemoryContent() {
  const container = document.getElementById('memory-content-area');
  if (!container) return;

  const graph = State.cachedMemoryGraph || { l3: { arcs: [] }, l2: [], l1: [], stats: { totalL1Traces: 0, totalL2Evidences: 0, verifiedCapabilities: 0, auditHealthScore: 100 } };
  const memData = State.cachedMemoryData || { observations: [], episodes: [], totalNotes: 0, library: [] };
  const expData = State.cachedExpData || { experiments: [] };

  const evidences = graph.l2 || [];
  const l1Traces = graph.l1 || [];
  const experiments = expData.experiments || [];
  const observations = memData.observations || [];
  const healthScore = graph.stats ? graph.stats.auditHealthScore : 100;
  const verifiedCaps = graph.stats ? graph.stats.verifiedCapabilities : 0;

  container.innerHTML = `
    <!-- 1. Pipeline Hero: 3-Layer Audit Memory (DeepTutor L1 -> L2 -> L3) -->
    <div class="p-2.5 rounded-xl theme-card border theme-border text-xs space-y-2 shadow-sm">
      <div class="flex items-center justify-between">
        <span class="font-bold theme-accent flex items-center gap-1.5 text-[11px]">
          <i data-lucide="shield-check" class="w-3.5 h-3.5 theme-accent"></i>
          <span>3-Layer Auditable Memory</span>
        </span>
        <span class="text-[9px] font-mono px-1.5 py-0.2 rounded border flex items-center gap-1 font-bold" style="background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);">
          <span class="w-1.5 h-1.5 rounded-full theme-bg-accent animate-pulse"></span>
          <span>${healthScore}% Auditable</span>
        </span>
      </div>

      <!-- 3-Layer Flow Bar -->
      <div class="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
        <div class="p-1.5 rounded-lg border theme-border" style="background-color: var(--bg-card-hover);">
          <div class="text-[9px]" style="color: var(--text-dim);">L3 Synthesis</div>
          <div class="font-bold text-[11px] theme-accent">${verifiedCaps} Goals</div>
        </div>
        <div class="p-1.5 rounded-lg border theme-border" style="background-color: var(--bg-card-hover);">
          <div class="text-[9px]" style="color: var(--text-dim);">L2 Facts</div>
          <div class="font-bold text-[11px] theme-accent">${evidences.length} Evidences</div>
        </div>
        <div class="p-1.5 rounded-lg border theme-border" style="background-color: var(--bg-card-hover);">
          <div class="text-[9px]" style="color: var(--text-dim);">L1 Traces</div>
          <div class="font-bold text-[11px] theme-accent">${l1Traces.length} Logs</div>
        </div>
      </div>
    </div>

    <!-- 2. Filter Pills -->
    <div class="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-mono shrink-0 select-none">
      <button onclick="setMemoryFilter('all')" class="px-2 py-0.5 rounded-lg ${State.activeMemoryFilter === 'all' ? 'btn-primary font-bold' : 'btn-secondary'} cursor-pointer transition-all">All</button>
      <button onclick="setMemoryFilter('l2')" class="px-2 py-0.5 rounded-lg ${State.activeMemoryFilter === 'l2' ? 'btn-primary font-bold' : 'btn-secondary'} cursor-pointer transition-all">L2 Facts (${evidences.length})</button>
      <button onclick="setMemoryFilter('l1')" class="px-2 py-0.5 rounded-lg ${State.activeMemoryFilter === 'l1' ? 'btn-primary font-bold' : 'btn-secondary'} cursor-pointer transition-all">L1 Traces (${l1Traces.length})</button>
      <button onclick="setMemoryFilter('experiments')" class="px-2 py-0.5 rounded-lg ${State.activeMemoryFilter === 'experiments' ? 'btn-primary font-bold' : 'btn-secondary'} cursor-pointer transition-all">Experiments (${experiments.length})</button>
      <button onclick="setMemoryFilter('obs')" class="px-2 py-0.5 rounded-lg ${State.activeMemoryFilter === 'obs' ? 'btn-primary font-bold' : 'btn-secondary'} cursor-pointer transition-all">Obs (${observations.length})</button>
    </div>

    <!-- 3. L2 Curated Surface Facts & Evidences -->
    ${(State.activeMemoryFilter === 'all' || State.activeMemoryFilter === 'l2') ? `
      <div class="space-y-1.5 pt-1">
        <div class="text-[10px] font-bold theme-accent uppercase tracking-wider flex items-center justify-between px-0.5">
          <span class="flex items-center gap-1"><i data-lucide="shield-check" class="w-3 h-3"></i><span>L2 Audited Facts &amp; Evidence</span></span>
          <button onclick="promptAddEvidence()" class="text-[10px] theme-accent hover:underline font-bold cursor-pointer">+ Record Fact</button>
        </div>
        <div class="space-y-2">
          ${evidences.length === 0 ? `
            <div class="text-[11px] p-2 theme-card rounded-xl border theme-border text-center" style="color: var(--text-dim);">
              No audited facts recorded yet.
            </div>
          ` : ''}
          ${evidences.map(ev => `
            <div class="p-2.5 rounded-xl theme-card border theme-border text-[11px] space-y-2 group hover:border-[var(--accent)] transition-all shadow-sm">
              <div class="flex items-center justify-between gap-1">
                <span class="text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase font-bold flex items-center gap-1" style="background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);">
                  <i data-lucide="award" class="w-2.5 h-2.5"></i>
                  <span>${escapeHtml(ev.surface)}</span>
                </span>
                <div class="flex items-center gap-1.5">
                  <span class="text-[9px] font-mono" style="color: var(--text-dim);">${escapeHtml(ev.id)}</span>
                  <button onclick="editEvidence('${escapeHtml(ev.id)}')" title="Edit Evidence" class="p-0.5 text-zinc-400 hover:text-[var(--accent)] transition-colors cursor-pointer">
                    <i data-lucide="edit-3" class="w-3 h-3"></i>
                  </button>
                  <button onclick="promptDeleteEvidence('${escapeHtml(ev.id)}', '${escapeHtml(ev.claim)}')" title="Delete Evidence" class="p-0.5 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                  </button>
                </div>
              </div>
              <div class="font-bold leading-snug" style="color: var(--text-main);">${escapeHtml(ev.claim)}</div>
              ${ev.metric ? `
                <div class="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-lg border theme-border" style="background-color: var(--accent-subtle); color: var(--accent);">
                  <i data-lucide="gauge" class="w-3 h-3 theme-accent shrink-0"></i>
                  <span>${escapeHtml(ev.metric)}</span>
                </div>
              ` : ''}
              <div class="text-[9px] font-mono p-1.5 rounded-lg border theme-border flex items-center justify-between gap-1" style="background-color: var(--code-bg); color: var(--text-muted);">
                <span class="truncate">L3 [${escapeHtml(ev.arcId || 'Goal')}] ➔ L2 [${escapeHtml(ev.id)}] ➔ L1 [${escapeHtml(ev.sourceL1Id)}]</span>
              </div>
              ${ev.reproductionCommand ? `
                <div class="flex items-center justify-between gap-1 px-2 py-1 rounded-lg border theme-border text-[10px] font-code" style="background-color: var(--code-bg); color: var(--text-main);">
                  <span class="truncate theme-accent">$ ${escapeHtml(ev.reproductionCommand)}</span>
                  <button onclick="copyToClipboard('${escapeHtml(ev.reproductionCommand)}', this)" class="hover:text-[var(--text-main)] text-[9px] font-sans shrink-0 cursor-pointer" style="color: var(--text-dim);">Copy</button>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- 4. L1 Raw Event Traces & Episodic History -->
    ${(State.activeMemoryFilter === 'all' || State.activeMemoryFilter === 'l1') ? `
      <div class="space-y-1.5 pt-2 border-t theme-border">
        <div class="text-[10px] font-bold theme-accent uppercase tracking-wider flex items-center justify-between px-0.5">
          <span class="flex items-center gap-1"><i data-lucide="history" class="w-3 h-3"></i><span>L1 Raw Traces &amp; Sessions</span></span>
          <div class="flex items-center gap-1.5">
            <span class="font-mono text-[10px]" style="color: var(--text-dim);">${l1Traces.length} Traces</span>
            ${l1Traces.length > 0 ? `
              <button onclick="promptClearAllEpisodes()" class="text-[10px] text-red-400 hover:text-red-300 font-semibold cursor-pointer">Clear</button>
            ` : ''}
          </div>
        </div>

        <div class="space-y-1.5">
          ${l1Traces.length === 0 ? `
            <div class="text-[11px] p-2 theme-card rounded-xl border theme-border text-center" style="color: var(--text-dim);">
              No raw traces recorded yet.
            </div>
          ` : ''}

          ${l1Traces.map((tr) => `
            <div class="p-2.5 rounded-xl theme-card border theme-border text-[11px] space-y-1.5 group hover:border-[var(--accent)] transition-all">
              <div class="flex items-center justify-between" style="color: var(--text-muted);">
                <span class="font-bold theme-accent flex items-center gap-1">
                  <i data-lucide="terminal" class="w-3 h-3"></i>
                  <span>${escapeHtml(tr.timestamp || 'Today')}</span>
                </span>
                <div class="flex items-center gap-1.5">
                  <span class="text-[10px] px-1.5 py-0.2 rounded font-mono border theme-border" style="background-color: var(--bg-card-hover); color: var(--text-muted);">${escapeHtml(tr.id)}</span>
                  <button onclick="promptDeleteEpisode(${tr.index}, '${escapeHtml(tr.timestamp || '')}', '${escapeHtml(tr.projectSlug || '')}', '${escapeHtml(tr.topic || tr.summary || '')}')" title="Delete Trace Record" class="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-red-400 transition-opacity cursor-pointer">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                  </button>
                </div>
              </div>
              <div class="font-medium text-[11px] leading-snug" style="color: var(--text-main);">${escapeHtml(tr.summary)}</div>
              <div class="text-[9px] font-mono truncate" style="color: var(--text-dim);">Origem: ${escapeHtml(tr.source)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- 5. Tiny Experiments -->
    ${(State.activeMemoryFilter === 'all' || State.activeMemoryFilter === 'experiments') ? `
      <div class="space-y-1.5 pt-2 border-t theme-border">
        <div class="text-[10px] font-bold theme-accent uppercase tracking-wider flex items-center justify-between px-0.5">
          <span class="flex items-center gap-1"><i data-lucide="flask-conical" class="w-3 h-3"></i><span>Tiny Experiments</span></span>
          <button onclick="promptAddExperiment()" class="text-[10px] theme-accent hover:underline font-bold cursor-pointer">+ Novo</button>
        </div>
        <div class="space-y-1.5">
          ${experiments.length === 0 ? `
            <div class="text-[11px] p-2 theme-card rounded-xl border theme-border text-center" style="color: var(--text-dim);">
              Nenhum experimento registrado ainda.
            </div>
          ` : ''}
          ${experiments.map(exp => {
            const isActive = exp.status === 'active';
            const isKept = exp.status === 'kept';
            const isDropped = exp.status === 'dropped';
            return `
              <div class="p-2.5 rounded-xl theme-card border ${isActive ? 'border-[var(--accent)]' : 'theme-border'} text-xs space-y-1.5 group">
                <div class="flex items-center justify-between gap-1">
                  <span class="font-bold text-[11px] flex-1" style="color: var(--text-main);">${escapeHtml(exp.title)}</span>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span class="text-[9px] font-mono px-1.5 py-0.2 rounded uppercase border font-bold" style="${isActive ? 'background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);' : isKept ? 'background-color: rgba(16, 185, 129, 0.15); color: #34d399; border-color: #059669;' : 'background-color: var(--bg-card-hover); color: var(--text-dim); border-color: var(--border-subtle);'}">${isKept ? '✓ Mantido' : isDropped ? '✗ Descartado' : '⚡ Ativo'}</span>
                    <button onclick="promptDeleteExperiment('${escapeHtml(exp.id)}', '${escapeHtml(exp.title)}')" title="Excluir Experimento" class="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-red-400 transition-opacity cursor-pointer">
                      <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>
                  </div>
                </div>
                ${exp.hypothesis ? `
                  <div class="text-[10px] leading-snug" style="color: var(--text-muted);">
                    <span class="theme-accent font-semibold">Hypothesis:</span> ${escapeHtml(exp.hypothesis)}
                  </div>
                ` : ''}
                ${exp.tweak ? `
                  <div class="text-[10px] leading-snug" style="color: var(--text-muted);">
                    <span class="theme-accent font-semibold">Intervention:</span> ${escapeHtml(exp.tweak)}
                  </div>
                ` : ''}
                <div class="pt-1 flex items-center justify-end gap-1.5">
                  ${isActive ? `
                    <button onclick="updateExperimentStatus('${escapeHtml(exp.id)}', 'kept')" class="px-2.5 py-1 btn-primary rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1 transition-all cursor-pointer">
                      <i data-lucide="check" class="w-3 h-3"></i>
                      <span>Keep</span>
                    </button>
                    <button onclick="updateExperimentStatus('${escapeHtml(exp.id)}', 'dropped')" class="px-2.5 py-1 btn-secondary rounded-lg text-[10px] transition-all cursor-pointer">
                      Drop
                    </button>
                  ` : `
                    <button onclick="updateExperimentStatus('${escapeHtml(exp.id)}', 'active')" class="px-2 py-0.5 btn-secondary rounded text-[9px] font-mono cursor-pointer">
                      ↻ Reactivate
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}

    <!-- 6. Semantic Observations -->
    ${(State.activeMemoryFilter === 'all' || State.activeMemoryFilter === 'obs') ? `
      <div class="space-y-1.5 pt-2 border-t theme-border">
        <div class="text-[10px] font-bold theme-accent uppercase tracking-wider flex items-center justify-between px-0.5">
          <span class="flex items-center gap-1"><i data-lucide="sparkles" class="w-3 h-3"></i><span>Semantic Observations</span></span>
          <button onclick="promptAddObservation()" class="text-[10px] theme-accent hover:underline font-bold cursor-pointer">+ Add</button>
        </div>
        <div class="space-y-1">
          ${observations.length === 0 ? `
            <div class="text-[11px] p-2 theme-card rounded-xl border theme-border text-center" style="color: var(--text-dim);">
              No observations recorded.
            </div>
          ` : ''}
          ${observations.map((o, idx) => `
            <div class="p-2 rounded-lg theme-card border theme-border text-[11px] leading-relaxed flex items-start justify-between gap-1 group hover:border-[var(--accent)] transition-all">
              <div class="flex-1">
                <span class="font-bold theme-accent">[${escapeHtml(o.tag)}]:</span>
                <span class="ml-1" style="color: var(--text-main);">${escapeHtml(o.text)}</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button onclick="editObservation(${idx})" title="Edit Observation" class="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-[var(--accent)] transition-opacity cursor-pointer">
                  <i data-lucide="edit-3" class="w-3 h-3"></i>
                </button>
                <button onclick="promptDeleteObservation(${idx}, '${escapeHtml(o.tag)}', '${escapeHtml(o.text)}')" title="Delete Observation" class="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-red-400 transition-opacity cursor-pointer">
                  <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  lucide.createIcons();
}

// =========================================================================
// MEMORY AUDIT EVIDENCE HANDLERS (Add, Edit, Delete)
// =========================================================================
export function promptAddEvidence() {
  State.editingEvidenceId = null;
  document.getElementById('new-ev-claim').value = '';
  document.getElementById('new-ev-metric').value = '';
  document.getElementById('new-ev-surface').value = 'benchmark';
  document.getElementById('new-ev-arc').value = 'arc1_behavior';
  document.getElementById('new-ev-cap').value = '';
  document.getElementById('new-ev-cmd').value = '';
  document.getElementById('new-ev-trace').value = '';
  document.getElementById('evidence-modal-title').textContent = "Record Auditable Fact & Evidence";
  document.getElementById('evidence-modal-submit-btn').textContent = "Save L2 Fact";
  document.getElementById('add-evidence-modal').classList.remove('hidden');
  document.getElementById('new-ev-claim').focus();
}

export function editEvidence(id) {
  const graph = State.cachedMemoryGraph || {};
  const ev = (graph.l2 || []).find(e => e.id === id);
  if (!ev) return;
  State.editingEvidenceId = id;
  document.getElementById('new-ev-claim').value = ev.claim || '';
  document.getElementById('new-ev-metric').value = ev.metric || '';
  document.getElementById('new-ev-surface').value = ev.surface || 'benchmark';
  document.getElementById('new-ev-arc').value = ev.arcId || 'arc1_behavior';
  document.getElementById('new-ev-cap').value = ev.capabilityId || '';
  document.getElementById('new-ev-cmd').value = ev.reproductionCommand || '';
  document.getElementById('new-ev-trace').value = ev.sourceL1Id || '';
  document.getElementById('evidence-modal-title').textContent = `Edit L2 Fact (${id})`;
  document.getElementById('evidence-modal-submit-btn').textContent = "Save Changes";
  document.getElementById('add-evidence-modal').classList.remove('hidden');
  document.getElementById('new-ev-claim').focus();
}

export function closeAddEvidenceModal() {
  document.getElementById('add-evidence-modal').classList.add('hidden');
  State.editingEvidenceId = null;
}

export async function handleCreateEvidenceSubmit(e) {
  e.preventDefault();
  const claim = document.getElementById('new-ev-claim').value.trim();
  const metric = document.getElementById('new-ev-metric').value.trim();
  const surface = document.getElementById('new-ev-surface').value;
  const arcId = document.getElementById('new-ev-arc').value;
  const capabilityId = document.getElementById('new-ev-cap').value.trim();
  const reproductionCommand = document.getElementById('new-ev-cmd').value.trim();
  const sourceL1Id = document.getElementById('new-ev-trace').value.trim() || `ep-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-01`;

  if (!claim) return;

  try {
    const res = await fetch(`${API_BASE}/api/memory/evidence/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: State.editingEvidenceId || undefined,
        claim,
        metric,
        surface,
        arcId,
        capabilityId,
        reproductionCommand,
        sourceL1Id
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    closeAddEvidenceModal();
    loadMemoryData();
  } catch (err) {
    alert(`Error saving L2 fact: ${err.message}`);
  }
}

export function promptDeleteEvidence(id, claim) {
  State.pendingDeleteTarget = { type: 'evidence', id };
  document.getElementById('delete-modal-title').textContent = "Delete Auditable L2 Fact";
  document.getElementById('delete-modal-desc').textContent = "Are you sure you want to delete this auditable evidence?";
  document.getElementById('delete-target-label').textContent = `${id}: ${(claim || '').slice(0, 80)}`;
  document.getElementById('delete-modal-subdesc').textContent = "The fact will be removed from the L2 evidence graph and the audit score will be recalculated.";
  document.getElementById('delete-archive-option-btn').classList.add('hidden');
  document.getElementById('delete-confirm-modal').classList.remove('hidden');
}

// =========================================================================
// MEMORY OBSERVATION HANDLERS (Add, Edit, Delete)
// =========================================================================
export function promptAddObservation() {
  State.editingObsIndex = null;
  document.getElementById('new-obs-tag').value = 'Insight';
  document.getElementById('new-obs-text').value = '';
  document.getElementById('obs-modal-title').textContent = "Add Semantic Observation";
  document.getElementById('obs-modal-submit-btn').textContent = "Save Observation";
  document.getElementById('add-obs-modal').classList.remove('hidden');
  document.getElementById('new-obs-text').focus();
}

export function editObservation(index) {
  const mem = State.cachedMemoryData || {};
  const obs = (mem.observations || [])[index];
  if (!obs) return;
  State.editingObsIndex = index;
  document.getElementById('new-obs-tag').value = obs.tag || 'Insight';
  document.getElementById('new-obs-text').value = obs.text || '';
  document.getElementById('obs-modal-title').textContent = "Edit Semantic Observation";
  document.getElementById('obs-modal-submit-btn').textContent = "Update Observation";
  document.getElementById('add-obs-modal').classList.remove('hidden');
  document.getElementById('new-obs-text').focus();
}

export function closeAddObsModal() {
  document.getElementById('add-obs-modal').classList.add('hidden');
  State.editingObsIndex = null;
}

export async function handleCreateObsSubmit(e) {
  e.preventDefault();
  const tag = document.getElementById('new-obs-tag').value.trim();
  const text = document.getElementById('new-obs-text').value.trim();
  if (!text) return;

  try {
    const isEditing = State.editingObsIndex !== null;
    const endpoint = isEditing ? `${API_BASE}/api/memory/observation/update` : `${API_BASE}/api/memory/observation/add`;
    const body = isEditing ? { index: State.editingObsIndex, tag, text } : { tag, text };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    closeAddObsModal();
    loadMemoryData();
  } catch (err) {
    alert(`Error saving observation: ${err.message}`);
  }
}

export function promptDeleteObservation(index, tag, text) {
  State.pendingDeleteTarget = { type: 'observation', index };
  document.getElementById('delete-modal-title').textContent = "Delete Semantic Observation";
  document.getElementById('delete-modal-desc').textContent = "Are you sure you want to remove this observation from the agent's memory?";
  document.getElementById('delete-target-label').textContent = `[${tag}]: ${(text || '').slice(0, 80)}`;
  document.getElementById('delete-modal-subdesc').textContent = "This directive or calibration will no longer be injected into the tutor's context.";
  document.getElementById('delete-archive-option-btn').classList.add('hidden');
  document.getElementById('delete-confirm-modal').classList.remove('hidden');
}

// =========================================================================
// EPISODIC TIMELINE & TRACES HANDLERS (Delete, Clear)
// =========================================================================
export function promptDeleteEpisode(index, date, projectSlug, topic) {
  State.pendingDeleteTarget = { type: 'episode', index, date, projectSlug, topic };
  document.getElementById('delete-modal-title').textContent = "Delete L1 Episode Record";
  document.getElementById('delete-modal-desc').textContent = "Are you sure you want to delete this session from episodic memory?";
  document.getElementById('delete-target-label').textContent = `${date || 'Today'} - ${projectSlug || 'OS'}: ${(topic || '').slice(0, 60)}`;
  document.getElementById('delete-modal-subdesc').textContent = "The raw trace record will be removed from EPISODES.jsonl.";
  document.getElementById('delete-archive-option-btn').classList.add('hidden');
  document.getElementById('delete-confirm-modal').classList.remove('hidden');
}

export function promptClearAllEpisodes() {
  State.pendingDeleteTarget = { type: 'episodes-clear' };
  document.getElementById('delete-modal-title').textContent = "Clear Episodic Memory (L1)";
  document.getElementById('delete-modal-desc').textContent = "Are you sure you want to erase all episodic session history?";
  document.getElementById('delete-target-label').textContent = "EPISODES.jsonl (All session records)";
  document.getElementById('delete-modal-subdesc').textContent = "This action will clear all summaries of previous sessions.";
  document.getElementById('delete-archive-option-btn').classList.add('hidden');
  document.getElementById('delete-confirm-modal').classList.remove('hidden');
}

// =========================================================================
// PURGE MEMORY HANDLER (Hard Reset / Start Fresh)
// =========================================================================
export function promptPurgeMemory() {
  document.getElementById('purge-memory-modal').classList.remove('hidden');
}

export function closePurgeMemoryModal() {
  document.getElementById('purge-memory-modal').classList.add('hidden');
}

export async function executeMemoryPurge() {
  try {
    const res = await fetch(`${API_BASE}/api/memory/purge`, {
      method: "POST"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    closePurgeMemoryModal();
    createNewThread();
    await loadMemoryData();
    await loadThreadsList();
  } catch (err) {
    alert(`Error purging memory: ${err.message}`);
  }
}

// =========================================================================
// TINY EXPERIMENTS HANDLERS
// =========================================================================
export function promptDeleteExperiment(expId, title) {
  State.pendingDeleteTarget = { type: 'experiment', id: expId };
  document.getElementById('delete-modal-title').textContent = "Delete Experiment";
  document.getElementById('delete-modal-desc').textContent = "Are you sure you want to delete this experiment?";
  document.getElementById('delete-target-label').textContent = `${expId}: ${title || ''}`;
  document.getElementById('delete-modal-subdesc').textContent = "The experiment will be permanently removed from the collection.";
  document.getElementById('delete-archive-option-btn').classList.add('hidden');
  document.getElementById('delete-confirm-modal').classList.remove('hidden');
}

export async function updateExperimentStatus(expId, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/api/experiments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateStatus",
        id: expId,
        status: newStatus
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    loadMemoryData();
  } catch (err) {
    alert(`Erro ao atualizar experimento: ${err.message}`);
  }
}

export function promptAddExperiment() {
  document.getElementById('new-exp-title').value = '';
  document.getElementById('new-exp-hypothesis').value = '';
  document.getElementById('new-exp-tweak').value = '';
  document.getElementById('add-experiment-modal').classList.remove('hidden');
  document.getElementById('new-exp-title').focus();
}

export function closeAddExperimentModal() {
  document.getElementById('add-experiment-modal').classList.add('hidden');
}

export async function handleCreateExperimentSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('new-exp-title').value.trim();
  const hypothesis = document.getElementById('new-exp-hypothesis').value.trim();
  const tweak = document.getElementById('new-exp-tweak').value.trim();
  if (!title) return;

  try {
    const res = await fetch(`${API_BASE}/api/experiments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        title,
        hypothesis,
        tweak
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    closeAddExperimentModal();
    loadMemoryData();
  } catch (err) {
    alert(`Erro ao adicionar experimento: ${err.message}`);
  }
}

// --- inline-handler surface (onclick/onsubmit="..." targets) ---
window.setMemoryFilter = setMemoryFilter;
window.loadMemoryData = loadMemoryData;
window.promptAddEvidence = promptAddEvidence;
window.editEvidence = editEvidence;
window.closeAddEvidenceModal = closeAddEvidenceModal;
window.handleCreateEvidenceSubmit = handleCreateEvidenceSubmit;
window.promptDeleteEvidence = promptDeleteEvidence;
window.promptAddObservation = promptAddObservation;
window.editObservation = editObservation;
window.closeAddObsModal = closeAddObsModal;
window.handleCreateObsSubmit = handleCreateObsSubmit;
window.promptDeleteObservation = promptDeleteObservation;
window.promptDeleteEpisode = promptDeleteEpisode;
window.promptClearAllEpisodes = promptClearAllEpisodes;
window.promptPurgeMemory = promptPurgeMemory;
window.closePurgeMemoryModal = closePurgeMemoryModal;
window.executeMemoryPurge = executeMemoryPurge;
window.promptDeleteExperiment = promptDeleteExperiment;
window.updateExperimentStatus = updateExperimentStatus;
window.promptAddExperiment = promptAddExperiment;
window.closeAddExperimentModal = closeAddExperimentModal;
window.handleCreateExperimentSubmit = handleCreateExperimentSubmit;
