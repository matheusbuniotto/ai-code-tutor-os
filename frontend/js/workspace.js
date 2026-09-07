// =========================================================================
// 12. WORKSPACE BROWSER & FILE MANAGEMENT (Active & Archived Projects)
// =========================================================================

import { API_BASE, State } from './state.js';
import { escapeHtml } from './utils.js';
import { renderMarkdown } from './markdown.js';
import { quickPrompt } from './ui-utils.js';

// --- VSCode-style file tree: build + render + collapse state ---
export function isTreeNodeOpen(key) { return !State.collapsedTreeNodes.has(key); }

export function onTreeToggle(detailsEl) {
  const key = detailsEl.dataset.treeKey;
  if (detailsEl.open) State.collapsedTreeNodes.delete(key);
  else State.collapsedTreeNodes.add(key);
  localStorage.setItem('tutor_tree_collapsed', JSON.stringify([...State.collapsedTreeNodes]));
}

// workspaceList already returns paths recursively (dirs and files mixed, flat).
// Rebuilds them into a nested tree for VSCode-style rendering.
export function buildFileTree(paths) {
  const root = { name: '', path: '', type: 'dir', children: [] };
  const nodeByPath = { '': root };

  for (const relPath of (paths || [])) {
    const parts = relPath.split('/');
    let parentPath = '';
    for (let i = 0; i < parts.length; i++) {
      const currentPath = parts.slice(0, i + 1).join('/');
      if (!nodeByPath[currentPath]) {
        const node = { name: parts[i], path: currentPath, type: 'file', children: [] };
        nodeByPath[currentPath] = node;
        nodeByPath[parentPath].children.push(node);
      }
      parentPath = currentPath;
    }
  }

  // Any node with children is a folder; a leaf with no extension = empty
  // folder (same convention the rest of the app uses for files, which
  // always have an extension).
  (function markDirs(node) {
    if (node.children.length > 0) node.type = 'dir';
    else if (!node.name.includes('.')) node.type = 'dir';
    node.children.forEach(markDirs);
  })(root);

  return root;
}

export function renderFileTreeNode(node, projectSlug, isArchived, depth) {
  const indent = depth * 14;
  if (node.type === 'dir') {
    const key = `${projectSlug}::${node.path}`;
    const isOpen = isTreeNodeOpen(key);
    const sortedChildren = [...node.children].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return `
      <details data-tree-key="${escapeHtml(key)}" ${isOpen ? 'open' : ''} ontoggle="onTreeToggle(this)">
        <summary class="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] flex items-center gap-1.5 cursor-pointer select-none text-[11px] list-none" style="color: var(--text-main); margin-left:${indent}px;">
          <i data-lucide="chevron-right" class="w-3 h-3 tree-chevron shrink-0"></i>
          <i data-lucide="folder" class="w-3.5 h-3.5 theme-accent shrink-0"></i>
          <span class="truncate font-medium">${escapeHtml(node.name)}</span>
        </summary>
        <div>
          ${sortedChildren.length === 0
            ? `<div class="text-[10px] p-1" style="color: var(--text-dim); margin-left:${indent + 20}px">(empty)</div>`
            : sortedChildren.map(c => renderFileTreeNode(c, projectSlug, isArchived, depth + 1)).join('')}
        </div>
      </details>
    `;
  }

  return `
    <div class="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] flex items-center justify-between group transition-colors" style="margin-left:${indent}px;">
      <div onclick="openWorkspaceFile('${escapeHtml(projectSlug)}', '${escapeHtml(node.path)}', ${isArchived ? 'true' : 'false'})" class="flex items-center gap-2 cursor-pointer flex-1 truncate text-[11px]" style="color: var(--text-main);">
        <i data-lucide="file-code" class="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0"></i>
        <span class="truncate ${node.name.endsWith('.md') ? 'font-medium' : ''}">${escapeHtml(node.name)}</span>
      </div>
      ${isArchived ? '' : `
        <button onclick="event.stopPropagation(); promptDeleteFile('${escapeHtml(projectSlug)}', '${escapeHtml(node.path)}', false)" title="Delete File" class="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-zinc-500 rounded transition-opacity cursor-pointer">
          <i data-lucide="trash" class="w-3 h-3"></i>
        </button>
      `}
    </div>
  `;
}

export function renderProjectFileTree(filesList, projectSlug, isArchived) {
  const tree = buildFileTree(filesList);
  if (tree.children.length === 0) return `<div class="text-[10px] text-zinc-500 p-1">No files</div>`;
  const sortedChildren = [...tree.children].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return sortedChildren.map(c => renderFileTreeNode(c, projectSlug, isArchived, 0)).join('');
}

export async function loadWorkspaceData() {
  try {
    const res = await fetch(`${API_BASE}/api/workspace`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Render NOW.md quick preview (rendered markdown, not raw text)
    const nowCard = document.getElementById('quick-now-card');
    nowCard.innerHTML = renderMarkdown(data.now && data.now.trim() ? data.now : "*No active mission right now.*");

    // Render Workspace Tree
    const treeContainer = document.getElementById('workspace-tree');
    const projects = data.projects || [];
    const archivedProjects = data.archivedProjects || [];

    treeContainer.innerHTML = `
      <!-- Root OS Files -->
      <div class="space-y-1 mb-2">
        <div class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-1">OS-Level Files</div>
        <div onclick="openWorkspaceFile(null, 'NOW.md')" class="p-2 rounded-xl theme-card hover:bg-[var(--bg-card-hover)] flex items-center justify-between cursor-pointer border theme-border app-no-drag">
          <div class="flex items-center gap-2">
            <i data-lucide="file-text" class="w-3.5 h-3.5 theme-accent pointer-events-none"></i>
            <span class="font-medium" style="color: var(--text-main);">NOW.md</span>
          </div>
          <span class="text-[10px] theme-accent font-semibold">Mission</span>
        </div>
        <div onclick="openWorkspaceFile(null, 'INBOX.md')" class="p-2 rounded-xl theme-card hover:bg-[var(--bg-card-hover)] flex items-center justify-between cursor-pointer border theme-border app-no-drag">
          <div class="flex items-center gap-2">
            <i data-lucide="inbox" class="w-3.5 h-3.5 theme-accent pointer-events-none"></i>
            <span class="font-medium" style="color: var(--text-main);">INBOX.md</span>
          </div>
          <span class="text-[10px] theme-accent font-semibold">Ideas</span>
        </div>
      </div>

      <!-- Active Projects List -->
      <div class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <span class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Active Projects</span>
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded" style="background-color: var(--accent-subtle); color: var(--accent);">${projects.length} active</span>
        </div>

        ${projects.length === 0 ? `
          <div class="p-3 rounded-xl theme-card border theme-border text-center text-xs" style="color: var(--text-dim);">
            No active projects right now.
          </div>
        ` : ''}

        ${projects.map(p => {
          const filesList = p.files || [];
          const projectKey = `${escapeHtml(p.slug)}::`;
          const projectOpen = isTreeNodeOpen(`${p.slug}::`);
          return `
            <details class="rounded-xl theme-card border theme-border overflow-hidden shadow-sm" data-tree-key="${projectKey}" ${projectOpen ? 'open' : ''} ontoggle="onTreeToggle(this)">

              <!-- Project Header & Actions (also the collapse toggle) -->
              <summary class="p-2.5 flex items-center justify-between border-b theme-border cursor-pointer select-none list-none" style="background-color: var(--bg-card-hover);">
                <div class="flex items-center gap-1.5 font-bold theme-accent truncate">
                  <i data-lucide="chevron-right" class="w-3.5 h-3.5 tree-chevron shrink-0"></i>
                  <i data-lucide="folder-code" class="w-4 h-4 theme-accent shrink-0"></i>
                  <span class="truncate">${escapeHtml(p.slug)}</span>
                </div>

                <div class="flex items-center gap-1 shrink-0">
                  <button onclick="event.stopPropagation(); event.preventDefault(); openNewFileModalForProject('${escapeHtml(p.slug)}')" title="New File" class="p-1 hover:bg-[var(--accent-subtle)] text-[var(--text-muted)] hover:text-[var(--accent)] rounded transition-colors cursor-pointer">
                    <i data-lucide="file-plus" class="w-3.5 h-3.5"></i>
                  </button>
                  <button onclick="event.stopPropagation(); event.preventDefault(); promptArchiveProject('${escapeHtml(p.slug)}')" title="Archive / Mark as Completed" class="p-1 hover:bg-[var(--accent-subtle)] text-[var(--text-muted)] hover:text-[var(--accent)] rounded transition-colors cursor-pointer">
                    <i data-lucide="archive" class="w-3.5 h-3.5"></i>
                  </button>
                  <button onclick="event.stopPropagation(); event.preventDefault(); promptDeleteProject('${escapeHtml(p.slug)}', false)" title="Delete Project" class="p-1 hover:bg-red-950/60 text-[var(--text-dim)] hover:text-red-400 rounded transition-colors cursor-pointer">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </summary>

              <!-- Project Files Tree -->
              <div class="p-1.5 space-y-0.5">
                ${renderProjectFileTree(filesList, p.slug, false)}
              </div>

            </details>
          `;
        }).join('')}
      </div>

      <!-- Archived / Completed Projects Section -->
      ${archivedProjects.length > 0 ? `
        <div class="pt-3 border-t theme-border mt-3 space-y-2">
          <details class="group theme-card rounded-xl border theme-border overflow-hidden" data-tree-key="_archive_section::" ${isTreeNodeOpen('_archive_section::') ? 'open' : ''} ontoggle="onTreeToggle(this)">
            <summary class="p-2.5 flex items-center justify-between cursor-pointer select-none text-[var(--text-muted)] hover:text-[var(--text-main)] list-none">
              <div class="flex items-center gap-2 text-xs font-semibold">
                <i data-lucide="chevron-right" class="w-3.5 h-3.5 tree-chevron shrink-0"></i>
                <i data-lucide="archive" class="w-3.5 h-3.5 theme-accent"></i>
                <span>Completed / Archived</span>
              </div>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-mono" style="background-color: var(--bg-card-hover); color: var(--text-muted);">${archivedProjects.length}</span>
            </summary>

            <div class="p-2 pt-0 space-y-2">
              ${archivedProjects.map(ap => {
                const filesList = ap.files || [];
                const key = `archive-${ap.slug}::`;
                return `
                  <details class="rounded-lg theme-card border theme-border overflow-hidden" data-tree-key="${escapeHtml(key)}" ${isTreeNodeOpen(key) ? 'open' : ''} ontoggle="onTreeToggle(this)">
                    <summary class="p-2 flex items-center justify-between cursor-pointer select-none list-none" style="background-color: var(--bg-card-hover);">
                      <div class="flex items-center gap-1.5 text-xs font-medium truncate" style="color: var(--text-main);">
                        <i data-lucide="chevron-right" class="w-3 h-3 tree-chevron shrink-0"></i>
                        <i data-lucide="check-circle-2" class="w-3.5 h-3.5 theme-accent shrink-0"></i>
                        <span class="truncate">${escapeHtml(ap.slug)}</span>
                      </div>
                      <div class="flex items-center gap-1 shrink-0">
                        <button onclick="event.stopPropagation(); event.preventDefault(); restoreProject('${escapeHtml(ap.slug)}')" title="Restaurar para Ativos" class="p-1 hover:bg-[var(--accent-subtle)] text-[var(--text-muted)] hover:text-[var(--accent)] rounded transition-colors cursor-pointer">
                          <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="event.stopPropagation(); event.preventDefault(); promptDeleteProject('${escapeHtml(ap.slug)}', true)" title="Excluir Definitivamente" class="p-1 hover:bg-red-950/80 text-[var(--text-dim)] hover:text-red-400 rounded transition-colors cursor-pointer">
                          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                      </div>
                    </summary>

                    <div class="p-1 text-[10px] space-y-0.5" style="color: var(--text-muted);">
                      ${renderProjectFileTree(filesList, ap.slug, true)}
                    </div>
                  </details>
                `;
              }).join('')}
            </div>
          </details>
        </div>
      ` : ''}
    `;

    lucide.createIcons();
  } catch (err) {
    console.error("Workspace load error:", err);
    const treeContainer = document.getElementById('workspace-tree');
    if (treeContainer) {
      treeContainer.innerHTML = `
        <div class="p-3 rounded-xl theme-card border theme-border text-center space-y-2">
          <div class="text-xs theme-accent">Servidor backend conectando...</div>
          <button onclick="loadWorkspaceData()" class="text-[10px] px-2 py-1 rounded btn-secondary cursor-pointer">Reconectar</button>
        </div>
      `;
    }
  }
}

// Open file in Editor
export async function openWorkspaceFile(slug, filePath, isArchived = false) {
  const modal = document.getElementById('file-modal');
  const title = document.getElementById('file-modal-title');
  const editor = document.getElementById('file-modal-editor');
  const saveStatus = document.getElementById('file-save-status');

  saveStatus.classList.add('hidden');
  title.textContent = slug ? `${isArchived ? '[Arquivado] ' : ''}${slug} / ${filePath}` : filePath;
  editor.value = "Carregando...";
  modal.classList.remove('hidden');

  try {
    const params = new URLSearchParams();
    if (slug) params.set("slug", slug);
    params.set("path", filePath);
    if (isArchived) params.set("archived", "true");

    const res = await fetch(`${API_BASE}/api/workspace/file?${params.toString()}`);
    const data = await res.json();

    State.currentPreviewFile = { slug, path: filePath, content: data.content || "", isArchived };
    editor.value = data.content || "";
    editor.focus();
  } catch (err) {
    editor.value = `Erro ao ler arquivo: ${err.message}`;
  }
}

// Save edited file
export async function saveCurrentFileContent() {
  const editor = document.getElementById('file-modal-editor');
  const saveStatus = document.getElementById('file-save-status');
  const newContent = editor.value;

  try {
    const res = await fetch(`${API_BASE}/api/workspace/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: State.currentPreviewFile.slug,
        path: State.currentPreviewFile.path,
        content: newContent,
        isArchived: State.currentPreviewFile.isArchived
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    State.currentPreviewFile.content = newContent;
    saveStatus.classList.remove('hidden');
    setTimeout(() => saveStatus.classList.add('hidden'), 2500);
    loadWorkspaceData();
  } catch (err) {
    alert(`Erro ao salvar arquivo: ${err.message}`);
  }
}

// Safe In-App Delete & Archive Handlers
export function promptDeleteFile(slug, filePath, isArchived = false) {
  State.pendingDeleteTarget = { type: 'file', slug, path: filePath, isArchived };
  document.getElementById('delete-modal-title').textContent = "Confirm File Deletion";
  document.getElementById('delete-modal-desc').textContent = "Are you sure you want to permanently delete the file:";
  document.getElementById('delete-target-label').textContent = `${slug ? slug + ' / ' : ''}${filePath}`;
  document.getElementById('delete-modal-subdesc').textContent = "This action is irreversible.";
  document.getElementById('delete-archive-option-btn').classList.add('hidden');
  document.getElementById('delete-confirm-modal').classList.remove('hidden');
  lucide.createIcons();
}

export function promptDeleteProject(slug, isArchived = false) {
  State.pendingDeleteTarget = { type: 'project', slug, path: null, isArchived };
  document.getElementById('delete-modal-title').textContent = isArchived ? "Delete Archived Project" : "Manage Project";
  document.getElementById('delete-modal-desc').textContent = isArchived
    ? "Are you sure you want to permanently delete from disk:"
    : "What would you like to do with this project?";
  document.getElementById('delete-target-label').textContent = `${isArchived ? '[Archived] ' : ''}Project: ${slug} (all artifacts)`;
  document.getElementById('delete-modal-subdesc').textContent = isArchived
    ? "All files in the archived folder will be permanently deleted."
    : "You can archive it as completed (preserving history) or delete it permanently.";

  const archiveBtn = document.getElementById('delete-archive-option-btn');
  if (isArchived) {
    archiveBtn.classList.add('hidden');
  } else {
    archiveBtn.classList.remove('hidden');
  }

  document.getElementById('delete-confirm-modal').classList.remove('hidden');
  lucide.createIcons();
}

export function deleteCurrentFile() {
  if (!State.currentPreviewFile.path) return;
  promptDeleteFile(State.currentPreviewFile.slug, State.currentPreviewFile.path, State.currentPreviewFile.isArchived);
}

export async function promptArchiveProject(slug) {
  if (!confirm(`Mark the project "${slug}" as completed and move it to the completed-archives folder?`)) return;
  await executeArchive(slug, "archive");
}

export async function restoreProject(slug) {
  await executeArchive(slug, "restore");
}

export async function executeArchive(slug, action) {
  try {
    const res = await fetch(`${API_BASE}/api/workspace/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, action })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    loadWorkspaceData();
  } catch (err) {
    alert(`Erro ao ${action === 'archive' ? 'arquivar' : 'restaurar'}: ${err.message}`);
  }
}

// In-App New File Handlers
export function openNewFileModalForProject(slug) {
  document.getElementById('new-file-slug').value = slug;
  document.getElementById('new-file-name').value = '';
  document.getElementById('new-file-modal').classList.remove('hidden');
  document.getElementById('new-file-name').focus();
}

export function closeNewFileModal() {
  document.getElementById('new-file-modal').classList.add('hidden');
}

export async function handleCreateFileSubmit(e) {
  e.preventDefault();
  const slug = document.getElementById('new-file-slug').value;
  const folder = document.getElementById('new-file-folder').value;
  const fileName = document.getElementById('new-file-name').value.trim();
  if (!fileName) return;

  const fullRelPath = folder ? `${folder}/${fileName}` : fileName;

  try {
    const res = await fetch(`${API_BASE}/api/workspace/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        path: fullRelPath,
        content: fullRelPath.endsWith('.md') ? `# ${fileName}\n\n` : `// ${fileName}\n`
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    closeNewFileModal();
    loadWorkspaceData();
    openWorkspaceFile(slug, fullRelPath);
  } catch (err) {
    alert(`Erro ao criar arquivo: ${err.message}`);
  }
}

// New Project Modal handlers
export function openNewProjectModal() { document.getElementById('new-project-modal').classList.remove('hidden'); }
export function closeNewProjectModal() { document.getElementById('new-project-modal').classList.add('hidden'); }

export async function handleCreateProjectSubmit(e) {
  e.preventDefault();
  const slug = document.getElementById('new-proj-slug').value.trim();
  const title = document.getElementById('new-proj-title').value.trim();
  const objective = document.getElementById('new-proj-obj').value.trim();
  const stack = document.getElementById('new-proj-stack').value.trim();

  try {
    const res = await fetch(`${API_BASE}/api/workspace/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, title, objective, stack })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    closeNewProjectModal();
    loadWorkspaceData();
    quickPrompt(`[PROJECT INITIALIZED: ${slug}] Starting Phase 1 of the Inverted Pyramid for "${title}".`);
  } catch (err) {
    alert(`Error creating project: ${err.message}`);
  }
}

export function injectCurrentFileInChat() {
  if (State.currentPreviewFile.content) {
    closeFileModal();
    quickPrompt(`[FILE: ${State.currentPreviewFile.slug || 'ROOT'}/${State.currentPreviewFile.path}]\n\`\`\`markdown\n${State.currentPreviewFile.content}\n\`\`\`\n\nAnalyze the state and implementation above.`);
  }
}

export function closeFileModal() { document.getElementById('file-modal').classList.add('hidden'); }

// --- inline-handler surface (onclick/onsubmit/ontoggle="..." targets) ---
window.onTreeToggle = onTreeToggle;
window.loadWorkspaceData = loadWorkspaceData;
window.openWorkspaceFile = openWorkspaceFile;
window.saveCurrentFileContent = saveCurrentFileContent;
window.promptDeleteFile = promptDeleteFile;
window.promptDeleteProject = promptDeleteProject;
window.deleteCurrentFile = deleteCurrentFile;
window.promptArchiveProject = promptArchiveProject;
window.restoreProject = restoreProject;
window.openNewFileModalForProject = openNewFileModalForProject;
window.closeNewFileModal = closeNewFileModal;
window.handleCreateFileSubmit = handleCreateFileSubmit;
window.openNewProjectModal = openNewProjectModal;
window.closeNewProjectModal = closeNewProjectModal;
window.handleCreateProjectSubmit = handleCreateProjectSubmit;
window.injectCurrentFileInChat = injectCurrentFileInChat;
window.closeFileModal = closeFileModal;
