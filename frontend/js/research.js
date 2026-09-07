// =========================================================================
// 11. MULTI-SOURCE WEB & ARXIV RESEARCH ENGINE
//     + DeepTutor PageIndex & surgical citation viewer
// =========================================================================

import { API_BASE, State } from './state.js';
import { escapeHtml } from './utils.js';
import { quickPrompt } from './ui-utils.js';
import { loadMemoryData } from './memory.js';
import { loadArcsData } from './arcs.js';

export function setResearchMode(mode) {
  State.currentResearchMode = mode;
  const webBtn = document.getElementById('research-mode-web-btn');
  const arxivBtn = document.getElementById('research-mode-arxiv-btn');
  const input = document.getElementById('sidebar-arxiv-query');

  if (mode === 'web') {
    if (webBtn) {
      webBtn.className = "flex-1 py-1 text-[10px] font-bold rounded-md bg-zinc-800 text-zinc-100 shadow-sm flex items-center justify-center gap-1 cursor-pointer transition-all";
    }
    if (arxivBtn) {
      arxivBtn.className = "flex-1 py-1 text-[10px] font-bold rounded-md text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1 cursor-pointer transition-all";
    }
    if (input) {
      input.placeholder = "Search the technical web (StackOverflow, GitHub, Wiki)...";
      if (!input.value || input.value === "lsm tree write amplification") {
        input.value = "rust memory ordering acquire release";
      }
    }
  } else {
    if (webBtn) {
      webBtn.className = "flex-1 py-1 text-[10px] font-bold rounded-md text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1 cursor-pointer transition-all";
    }
    if (arxivBtn) {
      arxivBtn.className = "flex-1 py-1 text-[10px] font-bold rounded-md bg-zinc-800 text-zinc-100 shadow-sm flex items-center justify-center gap-1 cursor-pointer transition-all";
    }
    if (input) {
      input.placeholder = "Search arXiv / OpenAlex (250M+ papers)...";
      if (!input.value || input.value === "rust memory ordering acquire release") {
        input.value = "lsm tree write amplification";
      }
    }
  }
  handleSidebarPaperSearch();
}

export async function handleSidebarPaperSearch(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('sidebar-arxiv-query');
  const query = input.value.trim();
  if (!query) return;

  const container = document.getElementById('sidebar-papers-results');
  const badge = document.getElementById('sidebar-papers-badge');
  container.innerHTML = `<div class="p-3 text-zinc-400 text-xs animate-pulse flex items-center gap-2">
    <i data-lucide="loader-2" class="w-4 h-4 animate-spin theme-accent"></i>
    <span>Searching ${State.currentResearchMode === 'web' ? 'the Technical Web' : 'the arXiv archive'} for "${escapeHtml(query)}"...</span>
  </div>`;
  lucide.createIcons();

  try {
    const res = await fetch(`${API_BASE}/api/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        mode: State.currentResearchMode,
        maxResults: State.currentResearchMode === 'web' ? 8 : 12,
      })
    });
    const data = await res.json();

    // 1. Render Web Search Results
    if (State.currentResearchMode === 'web') {
      const results = data.results || [];
      const total = data.totalMatches || results.length;
      badge.textContent = `${total} Web Results`;

      if (results.length === 0) {
        container.innerHTML = `<div class="p-3 text-zinc-500 text-xs">No technical results found on the web.</div>`;
        return;
      }

      container.innerHTML = results.map((r) => {
        const sourceColor = r.source === 'StackOverflow' ? 'text-amber-400 bg-amber-950/80 border-amber-800' :
                           r.source === 'GitHub' ? 'text-purple-300 bg-purple-950/80 border-purple-800' :
                           r.source === 'Wikipedia' ? 'text-blue-300 bg-blue-950/80 border-blue-800' :
                           'text-emerald-300 bg-emerald-950/80 border-emerald-800';

        return `
          <div class="p-2.5 rounded-xl theme-card border theme-border hover:border-[var(--accent)] transition-all space-y-1.5 group app-no-drag">
            <div class="flex items-start justify-between gap-1.5">
              <div class="font-semibold text-zinc-100 line-clamp-2 leading-snug cursor-pointer hover:underline text-xs" onclick="injectPaperPrompt('${escapeHtml(r.title)}')">
                ${escapeHtml(r.title)}
              </div>
              <span class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold shrink-0 border ${sourceColor}">${escapeHtml(r.source)}</span>
            </div>

            <div class="text-[11px] text-zinc-400 line-clamp-2 font-sans leading-relaxed">
              ${escapeHtml(r.snippet || '')}
            </div>

            <div class="flex items-center justify-between pt-1 border-t theme-border text-[10px]">
              <button onclick="injectPaperPrompt('${escapeHtml(r.title)}')" class="px-2 py-0.5 rounded theme-card theme-accent font-bold flex items-center gap-1 border theme-border cursor-pointer">
                <i data-lucide="message-square" class="w-3 h-3 pointer-events-none"></i>
                <span>Cite in Chat</span>
              </button>

              ${r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" class="text-zinc-400 hover:text-zinc-200 flex items-center gap-0.5 cursor-pointer" data-tauri-drag-region="false">
                <span>View Source</span>
                <i data-lucide="external-link" class="w-2.5 h-2.5"></i>
              </a>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    // 2. Render Academic arXiv Results
    else {
      const papers = data.papers || [];
      const total = data.totalMatches || papers.length;
      badge.textContent = `${total > 50 ? total + '+' : total} Papers`;

      if (papers.length === 0) {
        container.innerHTML = `<div class="p-3 text-zinc-500 text-xs">No academic papers found.</div>`;
        return;
      }

      container.innerHTML = papers.map((p) => `
        <div class="p-2.5 rounded-xl theme-card border theme-border hover:border-amber-500/50 transition-all space-y-1.5 group app-no-drag">
          <div class="flex items-start justify-between gap-1.5">
            <div class="font-semibold text-amber-300 line-clamp-2 leading-snug cursor-pointer hover:underline text-xs" onclick="injectPaperPrompt('${escapeHtml(p.title)}')">
              ${escapeHtml(p.title)}
            </div>
          </div>

          <div class="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
            <span>${escapeHtml(p.published || '2024')}</span>
            ${p.citations !== undefined ? `<span class="theme-accent font-bold">★ ${p.citations} citations</span>` : ''}
            <span class="truncate text-zinc-500">${escapeHtml(p.authors ? p.authors[0] : 'Author')}</span>
          </div>

          <div class="text-[11px] text-zinc-400 line-clamp-2 font-sans leading-relaxed">
            ${escapeHtml(p.summary || '')}
          </div>

          <div class="flex items-center justify-between pt-1 border-t theme-border text-[10px] gap-1">
            <div class="flex items-center gap-1">
              <button onclick="injectPaperPrompt('${escapeHtml(p.title)}')" class="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold flex items-center gap-1 cursor-pointer border border-amber-500/30">
                <i data-lucide="message-square" class="w-3 h-3 pointer-events-none"></i>
                <span>Cite</span>
              </button>
              <button onclick="dissectPaper('${escapeHtml(p.url || '')}', '${escapeHtml(p.title)}', '${escapeHtml(p.summary || '')}')" class="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-bold flex items-center gap-1 cursor-pointer border border-emerald-700/60 transition-all shadow-sm">
                <i data-lucide="book-open" class="w-3 h-3 pointer-events-none"></i>
                <span>PageIndex</span>
              </button>
            </div>

            ${p.url ? `<a href="${escapeHtml(p.url)}" target="_blank" class="text-zinc-400 hover:text-zinc-200 flex items-center gap-0.5 cursor-pointer" data-tauri-drag-region="false">
              <span>View PDF</span>
              <i data-lucide="external-link" class="w-2.5 h-2.5"></i>
            </a>` : ''}
          </div>
        </div>
      `).join('');
    }

    lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<div class="p-3 text-red-400 text-xs">Search error: ${err.message}</div>`;
  }
}

export function injectPaperPrompt(title) {
  quickPrompt(`Explain how the paper "${title}" applies to the invariants and trade-offs of our implementation.`);
}

// =========================================================================
// DEEPTUTOR PAGEINDEX & SURGICAL CITATION VIEWER
// =========================================================================
export async function dissectPaper(url, title, abstract) {
  const modal = document.getElementById('paper-pageindex-modal');
  const container = document.getElementById('paper-pageindex-content');
  modal.classList.remove('hidden');
  container.innerHTML = `
    <div class="p-8 text-center text-zinc-400 space-y-3">
      <div class="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <div class="font-bold text-zinc-200 text-sm">Dissecting Paper with DeepTutor PageIndex...</div>
      <div class="text-xs text-zinc-400 font-mono">Indexing sections (§1-§5), mathematical theorems, and generating surgical citations...</div>
    </div>
  `;
  lucide.createIcons();

  try {
    const res = await fetch(`${API_BASE}/api/research/dissect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, title, abstract })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
    State.currentDissectionData = data.dissection;
    renderDissectionModal();
  } catch (err) {
    container.innerHTML = `
      <div class="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 space-y-2">
        <div class="font-bold">Erro ao dissecar paper:</div>
        <div class="text-xs font-mono">${escapeHtml(err.message)}</div>
        <button onclick="closePaperPageIndexModal()" class="px-3 py-1 bg-red-800 hover:bg-red-700 text-white rounded-lg text-xs font-bold mt-2 cursor-pointer">Fechar</button>
      </div>
    `;
  }
}

export function renderDissectionModal() {
  const d = State.currentDissectionData;
  if (!d) return;
  const container = document.getElementById('paper-pageindex-content');

  container.innerHTML = `
    <!-- 1. Header Card -->
    <div class="p-3 rounded-xl bg-zinc-900 border border-emerald-500/40 space-y-2">
      <div class="flex items-start justify-between gap-2">
        <div class="font-bold text-zinc-100 text-sm leading-snug">${escapeHtml(d.title)}</div>
        <span class="text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 font-bold" style="background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);">${escapeHtml(d.venue || 'Academic Literature')}</span>
      </div>
      <div class="text-[11px] flex items-center gap-2 font-mono" style="color: var(--text-muted);">
        <span>Authors: ${escapeHtml((d.authors || []).slice(0, 3).join(', '))}</span>
        <span>•</span>
        <span>Year: ${escapeHtml(d.year || '2024')}</span>
      </div>
      <div class="text-xs leading-relaxed p-2.5 rounded-lg border theme-border" style="background-color: var(--code-bg); color: var(--text-main);">
        <span class="theme-accent font-bold">Summary / Takeaway:</span> ${escapeHtml(d.oneLineTakeaway)}
      </div>
    </div>

    <!-- 2. Surgical Citation Box (DeepTutor Anchor) -->
    <div class="p-3 rounded-xl theme-card border theme-border space-y-2">
      <div class="flex items-center justify-between text-[11px]">
        <span class="font-bold theme-accent flex items-center gap-1.5">
          <i data-lucide="quote" class="w-3.5 h-3.5 theme-accent"></i>
          <span>Surgical Citation (Exact-Page Anchor)</span>
        </span>
        <button onclick="copyToClipboard('${escapeHtml(d.surgicalCitation)}', this)" class="px-2 py-0.5 rounded btn-primary text-[10px] font-bold cursor-pointer">
          Copy Citation
        </button>
      </div>
      <div class="p-2 rounded-lg border theme-border font-code text-xs select-all theme-accent" style="background-color: var(--code-bg);">
        ${escapeHtml(d.surgicalCitation)}
      </div>
    </div>

    <!-- 3. PageIndex Hierarchy (§1 to §5) -->
    <div class="space-y-2">
      <div class="text-[11px] font-bold theme-accent uppercase tracking-wider flex items-center gap-1.5">
        <i data-lucide="list-tree" class="w-3.5 h-3.5 theme-accent"></i>
        <span>PageIndex Structured by Section</span>
      </div>
      <div class="grid grid-cols-1 gap-2">
        ${(d.sections || []).map(sec => `
          <div class="p-2.5 rounded-xl theme-card border theme-border space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs flex items-center gap-1.5" style="color: var(--text-main);">
                <span class="px-1.5 py-0.2 rounded border font-mono text-[10px]" style="background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);">${escapeHtml(sec.sectionNumber)}</span>
                <span>${escapeHtml(sec.title)}</span>
              </span>
              <span class="text-[10px] font-mono px-1.5 py-0.2 rounded" style="background-color: var(--bg-card-hover); color: var(--text-dim);">p. ~${sec.pageEstimate}</span>
            </div>
            <div class="text-[11px] leading-snug" style="color: var(--text-muted);">${escapeHtml(sec.summary)}</div>
            ${(sec.keyInvariants && sec.keyInvariants.length > 0) ? `
              <div class="space-y-1 pt-1">
                ${sec.keyInvariants.map(inv => `
                  <div class="text-[10px] flex items-start gap-1 font-mono" style="color: var(--text-muted);">
                    <span class="theme-accent shrink-0">▸</span>
                    <span>${escapeHtml(inv)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 4. Core Theorems & Mathematical Axioms -->
    ${(d.theorems && d.theorems.length > 0) ? `
      <div class="space-y-2">
        <div class="text-[11px] font-bold theme-accent uppercase tracking-wider flex items-center gap-1.5">
          <i data-lucide="function-square" class="w-3.5 h-3.5 theme-accent"></i>
          <span>Theorems &amp; Topological Invariants</span>
        </div>
        <div class="space-y-2">
          ${d.theorems.map(thm => `
            <div class="p-3 rounded-xl theme-card border theme-border space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold theme-accent text-xs">${escapeHtml(thm.name)}</span>
                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded border" style="background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);">${escapeHtml(thm.section)}, p. ${thm.page}</span>
              </div>
              <div class="text-[11px] leading-relaxed" style="color: var(--text-main);">${escapeHtml(thm.statement)}</div>
              ${thm.formula ? `
                <div class="p-2 rounded border theme-border font-mono text-[11px] theme-accent" style="background-color: var(--code-bg);">
                  ${escapeHtml(thm.formula)}
                </div>
              ` : ''}
              <div class="text-[10px] p-1.5 rounded border theme-border" style="background-color: var(--bg-card-hover); color: var(--text-muted);">
                <span class="theme-accent font-semibold">Architectural Impact:</span> ${escapeHtml(thm.impactOnArchitecture)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- 5. Empirical Benchmarks -->
    ${(d.benchmarks && d.benchmarks.length > 0) ? `
      <div class="space-y-2">
        <div class="text-[11px] font-bold theme-accent uppercase tracking-wider flex items-center gap-1.5">
          <i data-lucide="gauge" class="w-3.5 h-3.5 theme-accent"></i>
          <span>Benchmarks &amp; Empirical Comparisons</span>
        </div>
        <div class="space-y-2">
          ${d.benchmarks.map(bm => `
            <div class="p-2.5 rounded-xl theme-card border theme-border text-xs space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs" style="color: var(--text-main);">${escapeHtml(bm.metricName)}</span>
                <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded border" style="background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);">${escapeHtml(bm.gainMultiplier)} Gain</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                <div class="p-1.5 rounded border theme-border" style="background-color: var(--code-bg);">
                  <span class="text-[9px] block" style="color: var(--text-dim);">Baseline:</span>
                  <span style="color: var(--text-muted);">${escapeHtml(bm.baseline)}</span>
                </div>
                <div class="p-1.5 rounded border theme-border" style="background-color: var(--accent-subtle);">
                  <span class="text-[9px] block theme-accent">Paper Result:</span>
                  <span class="font-bold theme-accent">${escapeHtml(bm.paperResult)}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- 6. 1-Click Export to L2 Audit Fact Graph -->
    <div class="p-3 rounded-xl theme-card border theme-border flex items-center justify-between gap-3 shadow-lg">
      <div class="space-y-0.5">
        <div class="font-bold theme-accent text-xs flex items-center gap-1">
          <i data-lucide="shield-check" class="w-4 h-4 theme-accent"></i>
          <span>Export to L2 Auditable Memory</span>
        </div>
        <div class="text-[10px]" style="color: var(--text-muted);">Links the theorem and proven metric to your L3 Arcs and L1 traces.</div>
      </div>
      <button id="btn-export-dissection-l2" onclick="exportDissectionToL2(this)" class="px-3 py-1.5 btn-primary text-xs font-bold rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer shrink-0 transition-all">
        <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
        <span>Record L2 Fact</span>
      </button>
    </div>
  `;

  lucide.createIcons();
}

export async function exportDissectionToL2(btn) {
  const d = State.currentDissectionData;
  if (!d) return;
  btn.disabled = true;
  btn.textContent = "Recording...";

  try {
    const rec = d.recommendedL2Evidence || {};
    const res = await fetch(`${API_BASE}/api/research/export-evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim: rec.claim || d.title,
        metric: rec.metric || "Proven in Academic Paper",
        surface: "benchmark",
        url: d.url,
        sourceRef: `${d.venue || 'arXiv'}: ${d.title}`,
        sourceL1Id: d.arxivId ? `arxiv-${d.arxivId}` : `paper-${d.id}`,
        surgicalCitation: d.surgicalCitation,
        reproductionCommand: rec.reproductionCommand || undefined,
        arcId: "arc1_behavior"
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    btn.textContent = "✓ Gravado no Grafo L2!";
    btn.classList.remove('bg-emerald-600', 'hover:bg-emerald-500');
    btn.classList.add('bg-zinc-800', 'text-emerald-400');
    loadMemoryData();
    loadArcsData();
  } catch (err) {
    alert(`Erro ao exportar fato L2: ${err.message}`);
    btn.disabled = false;
    btn.textContent = "Gravar Fato L2";
  }
}

export function closePaperPageIndexModal() {
  document.getElementById('paper-pageindex-modal').classList.add('hidden');
  State.currentDissectionData = null;
}

// --- inline-handler surface (onclick/onsubmit="..." targets) ---
window.setResearchMode = setResearchMode;
window.handleSidebarPaperSearch = handleSidebarPaperSearch;
window.injectPaperPrompt = injectPaperPrompt;
window.dissectPaper = dissectPaper;
window.exportDissectionToL2 = exportDissectionToL2;
window.closePaperPageIndexModal = closePaperPageIndexModal;
