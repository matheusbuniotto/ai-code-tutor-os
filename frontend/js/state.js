// =========================================================================
// SHARED APPLICATION STATE
// =========================================================================
// Every value here used to be a top-level `let` in app.js, shared implicitly
// through the single global script scope.
//
// These live as properties of ONE exported object on purpose: ES module live
// bindings are read-only from the importing side, so `export let x` could not
// be reassigned by another module. `State.x = ...` works from anywhere.

export const API_BASE = (window.location.protocol === 'file:' || window.location.origin.includes('tauri') || (window.location.hostname === 'localhost' && window.location.port !== '4115'))
  ? 'http://localhost:4115'
  : '';

export const State = {
  // --- Global UI & Workspace ---
  currentPreviewFile: { slug: null, path: null, content: "", isArchived: false },
  pendingDeleteTarget: { type: null, slug: null, path: null, isArchived: false },

  // --- Typography / preferences ---
  currentFontSize: parseInt(localStorage.getItem('tutor_font_size') || '18', 10),

  // --- Theme engine ---
  currentThemeFilter: 'all',
  customThemeState: {
    baseTone: 'obsidian',
    accent: '#10b981'
  },

  // --- Sessions, threads & chat streaming ---
  activeThreadId: localStorage.getItem('tutor_active_thread') || 'session-principal',
  currentAbortController: null,
  activeAgentFilter: null, // null = show all
  nowCardCollapsed: false,
  threadSearchQuery: '',

  // --- Scroll management ---
  userScrolledUp: false,

  // --- Workspace file tree collapse state ---
  collapsedTreeNodes: new Set(JSON.parse(localStorage.getItem('tutor_tree_collapsed') || '[]')),

  // --- Capability arcs ---
  cachedArcs: [],

  // --- Memory / audit graph ---
  cachedMemoryGraph: null,
  cachedMemoryData: null,
  cachedExpData: null,
  activeMemoryFilter: 'all',
  editingEvidenceId: null,
  editingObsIndex: null,

  // --- Research ---
  currentResearchMode: 'web',
  currentDissectionData: null,
};
