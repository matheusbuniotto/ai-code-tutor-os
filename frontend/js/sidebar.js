// =========================================================================
// 4. SIDEBAR TABS SWITCHING
// =========================================================================

import { loadWorkspaceData } from './workspace.js';
import { loadArcsData } from './arcs.js';
import { loadMemoryData } from './memory.js';

export function setSidebarTab(tabName) {
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar && sidebar.classList.contains('hidden')) {
    sidebar.classList.remove('hidden');
  }

  const tabs = ['chat', 'workspace', 'arcs', 'memory', 'research'];
  tabs.forEach(t => {
    const el = document.getElementById(`sidebar-tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (t === tabName || (t === 'arcs' && tabName === 'curriculum')) {
      if (el) el.classList.remove('hidden');
      if (btn) {
        btn.className = "px-3 py-1 rounded-lg text-xs font-semibold tab-btn-active flex items-center gap-1.5 transition-all shadow-sm cursor-pointer";
      }
    } else {
      if (el) el.classList.add('hidden');
      if (btn) {
        btn.className = "px-3 py-1 rounded-lg text-xs font-semibold tab-btn-inactive flex items-center gap-1.5 transition-all cursor-pointer";
      }
    }
  });
  lucide.createIcons();

  if (tabName === 'workspace') loadWorkspaceData();
  if (tabName === 'arcs' || tabName === 'curriculum') loadArcsData();
  if (tabName === 'memory') loadMemoryData();
}

export function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) sidebar.classList.toggle('hidden');
}

// --- inline-handler surface (onclick="..." targets) ---
window.setSidebarTab = setSidebarTab;
window.toggleSidebar = toggleSidebar;
