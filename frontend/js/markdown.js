// =========================================================================
// 1. MARKED.JS CONFIGURATION + MARKDOWN / THOUGHT RENDERING
// =========================================================================
// `marked`, `hljs` and `lucide` come from the classic CDN <script> tags in
// index.html — classic-script globals are visible inside ES modules.

import { escapeHtml, escapeJsString } from './utils.js';

marked.setOptions({
  highlight: function(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
  gfm: true,
  breaks: true
});

// Helper: Collapsible Thought
export function renderThought(thoughtText, container) {
  if (!thoughtText.trim()) return;
  container.classList.remove('hidden');
  container.innerHTML = `
    <details open class="theme-card border theme-border rounded-xl p-2.5 text-xs transition-all my-1.5">
      <summary class="hover:text-[var(--text-main)] cursor-pointer flex items-center gap-1.5 font-medium select-none" style="color: var(--text-muted);">
        <i data-lucide="sparkles" class="w-3.5 h-3.5 theme-accent"></i>
        <span>Reasoning Process (DeepSeek Thought)</span>
      </summary>
      <div class="mt-2 font-mono text-[11px] leading-relaxed pl-3 border-l-2 whitespace-pre-wrap" style="color: var(--text-muted); border-left-color: var(--accent);">
        ${escapeHtml(thoughtText)}
      </div>
    </details>
  `;
  lucide.createIcons();
}

// Helper: Markdown with Code Copy Button & Callouts
export function renderMarkdown(text) {
  if (!text.trim()) return '';

  // 1. Preprocess GitHub-style alerts: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
  let processed = text.replace(
    /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n((?:>.*\n?)*)/gim,
    (match, type, content) => {
      const t = type.toUpperCase();
      const cleanContent = content.replace(/^>\s?/gm, '').trim();
      const icon = t === 'NOTE' ? 'info' : t === 'TIP' ? 'lightbulb' : t === 'IMPORTANT' ? 'alert-circle' : t === 'WARNING' ? 'alert-triangle' : 'alert-octagon';
      const title = t === 'NOTE' ? 'Note' : t === 'TIP' ? 'Tip / Optimization' : t === 'IMPORTANT' ? 'Important' : t === 'WARNING' ? 'Warning' : 'Caution';
      return `<div class="callout-alert callout-${type.toLowerCase()}">
        <div class="flex items-center gap-1.5 font-bold text-xs mb-1">
          <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
          <span>${title}</span>
        </div>
        <div class="text-xs leading-relaxed">${marked.parse(cleanContent)}</div>
      </div>\n`;
    }
  );

  const rawHtml = marked.parse(processed);
  const temp = document.createElement('div');
  temp.innerHTML = rawHtml;

  temp.querySelectorAll('pre').forEach(pre => {
    const code = pre.querySelector('code');
    const lang = code ? (code.className.match(/language-(\w+)/) || [, 'code'])[1] : 'code';
    const codeText = code ? code.innerText : pre.innerText;

    const wrapper = document.createElement('div');
    wrapper.className = "rounded-xl border theme-border overflow-hidden my-3 shadow-sm";
    wrapper.style.backgroundColor = "var(--code-bg)";
    wrapper.style.borderColor = "var(--code-border)";

    const header = document.createElement('div');
    header.className = "h-8 px-3.5 border-b theme-border flex items-center justify-between text-xs font-mono";
    header.style.backgroundColor = "var(--bg-card)";
    header.style.borderColor = "var(--code-border)";
    header.style.color = "var(--text-muted)";
    header.innerHTML = `
      <span class="font-bold uppercase text-[11px] theme-accent">${escapeHtml(lang)}</span>
      <button onclick="copyCode(this, \`${escapeJsString(codeText)}\`)" class="hover:text-[var(--text-main)] flex items-center gap-1 text-[11px] font-sans cursor-pointer">
        <i data-lucide="copy" class="w-3 h-3"></i>
        <span>Copiar</span>
      </button>
    `;

    pre.className = "p-3.5 font-code text-xs overflow-x-auto m-0 leading-relaxed";
    pre.style.color = "var(--text-main)";
    wrapper.appendChild(header);
    wrapper.appendChild(pre.cloneNode(true));
    pre.replaceWith(wrapper);
  });

  return temp.innerHTML;
}

export function copyCode(btn, text) {
  navigator.clipboard.writeText(text);
  const orig = btn.innerHTML;
  btn.innerHTML = `<span class="theme-accent font-bold">Copiado!</span>`;
  setTimeout(() => { btn.innerHTML = orig; lucide.createIcons(); }, 2000);
}

export function copyMessageText(bubbleId, btn) {
  const el = document.getElementById(bubbleId);
  if (el) {
    navigator.clipboard.writeText(el.innerText);
    const orig = btn.innerHTML;
    btn.innerHTML = `<span class="theme-accent font-bold">Copiado!</span>`;
    setTimeout(() => { btn.innerHTML = orig; lucide.createIcons(); }, 2000);
  }
}

// --- inline-handler surface (onclick="..." targets) ---
window.copyCode = copyCode;
window.copyMessageText = copyMessageText;
