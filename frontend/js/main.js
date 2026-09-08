// =========================================================================
// ENTRY POINT — global keybindings + boot sequence
// =========================================================================
// Loaded from index.html as <script type="module" src="js/main.js">.
// Module scripts are deferred, so the DOM is already parsed when this runs
// (which is why the old app.js's loose top-level DOM lookups still work).

import { State } from './state.js';
import './markdown.js';
import { changeFontSize, loadSavedCustomTheme, setSkin } from './theme.js';
import { setSidebarTab, toggleSidebar } from './sidebar.js';
import './ui-utils.js';
import { createNewThread, loadThreadsList, switchThread } from './threads.js';
import './chat.js';
import { closeFileModal, closeNewProjectModal, loadWorkspaceData } from './workspace.js';
import './delete-modal.js';
import { closeNewArcModal } from './arcs.js';
import { closeAddObsModal, closePurgeMemoryModal } from './memory.js';
import { handleSidebarPaperSearch } from './research.js';
import { closeRescueModal, openRescueModal } from './rescue.js';
import { closeSettingsModal, openSettingsModal } from './settings.js';
import { closeQuickInboxModal, openQuickInboxModal } from './inbox.js';
import { closeOnboarding, maybeShowOnboarding } from './onboarding.js';
import './workspace-reset.js';

lucide.createIcons();

// Global Keybindings
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    changeFontSize(1);
    return;
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === '-')) {
    e.preventDefault();
    changeFontSize(-1);
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); openSettingsModal(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'r') { e.preventDefault(); openRescueModal(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); openQuickInboxModal(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); toggleSidebar(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); createNewThread(document.getElementById('agent-selector')?.value); }
  if (e.key === 'Escape') {
    closeRescueModal();
    closeSettingsModal();
    closeFileModal();
    closeNewProjectModal();
    closeNewArcModal();
    closeQuickInboxModal();
    closeAddObsModal();
    closePurgeMemoryModal();
    closeOnboarding();
  }
});

// Keyboard Shortcut for Chat Search (Cmd+K)
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    const searchInput = document.getElementById('thread-search-input');
    if (searchInput) {
      e.preventDefault();
      setSidebarTab('chat');
      searchInput.focus();
      searchInput.select();
    }
  }
});

// Initialize Theme (runs after every module above has been evaluated, so
// setSkin's downstream call into loadThreadsList can't hit anything in a
// temporal dead zone)
loadSavedCustomTheme();
const savedSkin = localStorage.getItem('tutor_skin') || 'classic';
setSkin(savedSkin);

// Auto-load initial data
loadThreadsList().then(() => switchThread(State.activeThreadId));
loadWorkspaceData();
handleSidebarPaperSearch();
maybeShowOnboarding();
