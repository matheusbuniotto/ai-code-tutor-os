// =========================================================================
// 2 + 3. FONT SCALING, THEME REGISTRY & DYNAMIC THEME ENGINE
// =========================================================================

import { State } from './state.js';
import { loadThreadsList } from './threads.js';

// -------------------------------------------------------------------------
// 2. Font Scaling & Preferences
// -------------------------------------------------------------------------
export function applyFontSize(size) {
  State.currentFontSize = Math.max(14, Math.min(26, size));
  document.getElementById('html-root').style.fontSize = `${State.currentFontSize}px`;
  const label = document.getElementById('font-size-label');
  if (label) label.textContent = `${State.currentFontSize}px`;
  const settingsVal = document.getElementById('settings-font-val');
  if (settingsVal) settingsVal.textContent = `${State.currentFontSize}px`;
  localStorage.setItem('tutor_font_size', State.currentFontSize.toString());

  // Update active state on modal buttons
  [14, 16, 18, 20, 22].forEach(sz => {
    const btn = document.getElementById(`font-btn-${sz}`);
    if (btn) {
      if (sz === State.currentFontSize) {
        btn.className = "p-2 rounded-lg font-bold shadow-sm border cursor-pointer";
        btn.style.backgroundColor = "var(--accent-subtle)";
        btn.style.color = "var(--accent)";
        btn.style.borderColor = "var(--accent)";
      } else {
        btn.className = "p-2 rounded-lg bg-zinc-900 border theme-border hover:border-[var(--accent)] font-medium transition-all text-zinc-300 cursor-pointer";
        btn.style.backgroundColor = "";
        btn.style.color = "";
        btn.style.borderColor = "";
      }
    }
  });
}
export function changeFontSize(delta) { applyFontSize(State.currentFontSize + delta); }
export function setFontSize(size) { applyFontSize(size); }
applyFontSize(State.currentFontSize);

// -------------------------------------------------------------------------
// 3. Theme registry & dynamic theme engine
// -------------------------------------------------------------------------
export const THEME_REGISTRY = [
  {
    id: 'classic',
    name: 'Tutor Classic',
    badge: 'Default Dark',
    icon: 'zap',
    category: 'dark',
    desc: 'Charcoal slate with emerald neon laser and tech cockpit vibe.',
    colors: { bg: '#0b0e14', card: '#151b27', border: '#232d40', accent: '#10b981' }
  },
  {
    id: 'matrix',
    name: "Matrix '99",
    badge: 'Terminal CRT',
    icon: 'terminal',
    category: 'retro',
    desc: 'Pure black background with green CRT phosphor and scanlines.',
    colors: { bg: '#020703', card: '#081a0c', border: '#14451e', accent: '#00ff66' }
  },
  {
    id: 'amber',
    name: 'Cyber Amber',
    badge: 'Retro 1983',
    icon: 'radio',
    category: 'retro',
    desc: 'Warm monochrome amber in a vintage CRT phosphor style.',
    colors: { bg: '#0c0803', card: '#1d1308', border: '#422912', accent: '#ff9d00' }
  },
  {
    id: 'nordic',
    name: 'Nordic Glacier',
    badge: 'Arctic Frost',
    icon: 'snowflake',
    category: 'dark',
    desc: 'Deep arctic navy blue with electric glacial cyan.',
    colors: { bg: '#070d18', card: '#101d33', border: '#1f3860', accent: '#00d2ff' }
  },
  {
    id: 'synthwave',
    name: 'Tokyo Synthwave',
    badge: 'Cyber Neon',
    icon: 'sparkles',
    category: 'cyber',
    desc: 'Violet obsidian with neon magenta and electric purple.',
    colors: { bg: '#0d0818', card: '#1d1234', border: '#3e226d', accent: '#ff2a85' }
  },
  {
    id: 'dracula',
    name: 'Dracula Pro',
    badge: 'Twilight',
    icon: 'moon',
    category: 'dark',
    desc: 'Dark twilight with electric lavender, cyan, and soft pink.',
    colors: { bg: '#1e1f29', card: '#282a36', border: '#44475a', accent: '#bd93f9' }
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox Dark',
    badge: 'Vintage Warm',
    icon: 'coffee',
    category: 'retro',
    desc: 'Retro earthy tones with warm orange and olive green.',
    colors: { bg: '#1d2021', card: '#282828', border: '#504945', accent: '#fe8019' }
  },
  {
    id: 'aqua',
    name: 'OS X Studio Light',
    badge: 'Clean Light',
    icon: 'sun',
    category: 'light',
    desc: 'Interface clara de alto contraste com azul cobalto e cinza platina.',
    colors: { bg: '#f4f6f9', card: '#ffffff', border: '#cbd5e1', accent: '#0284c7' }
  }
];

// Initialize custom theme from localStorage if available
export function loadSavedCustomTheme() {
  try {
    const saved = localStorage.getItem('tutor_custom_theme');
    if (saved) {
      const parsed = JSON.parse(saved);
      State.customThemeState = { ...State.customThemeState, ...parsed };
      injectCustomThemeCSS(State.customThemeState);
    }
  } catch (e) {
    console.warn("Could not load custom theme:", e);
  }
}

export function injectCustomThemeCSS(themeObj) {
  let styleEl = document.getElementById('custom-theme-vars');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-theme-vars';
    document.head.appendChild(styleEl);
  }

  const tonePresets = {
    obsidian:    { bgApp: '#0b0e14', bgSidebar: '#10141e', bgHeader: '#0e121a', bgCard: '#151b27', bgCardHover: '#1c2434', bgInput: '#121722', bgBubbleUser: '#182234', borderMain: '#232d40', borderSubtle: '#19202f', textMain: '#f3f4f6', textMuted: '#94a3b8', textDim: '#64748b' },
    pitch_black: { bgApp: '#020703', bgSidebar: '#040f06', bgHeader: '#030b05', bgCard: '#081a0c', bgCardHover: '#0e2a14', bgInput: '#051308', bgBubbleUser: '#0b2511', borderMain: '#14451e', borderSubtle: '#0d2e14', textMain: '#f0fdf4', textMuted: '#86efac', textDim: '#4ade80' },
    arctic_navy: { bgApp: '#070d18', bgSidebar: '#0b1424', bgHeader: '#09101d', bgCard: '#101d33', bgCardHover: '#172947', bgInput: '#0d1729', bgBubbleUser: '#152744', borderMain: '#1f3860', borderSubtle: '#142440', textMain: '#f0f6fc', textMuted: '#93c5fd', textDim: '#60a5fa' },
    synth_violet:{ bgApp: '#0d0818', bgSidebar: '#140d24', bgHeader: '#110a20', bgCard: '#1d1234', bgCardHover: '#2a1a4a', bgInput: '#160e29', bgBubbleUser: '#2b1448', borderMain: '#3e226d', borderSubtle: '#2a174a', textMain: '#faf5ff', textMuted: '#e9d5ff', textDim: '#c084fc' },
    warm_earth:  { bgApp: '#1d2021', bgSidebar: '#242728', bgHeader: '#202324', bgCard: '#282828', bgCardHover: '#32302f', bgInput: '#222425', bgBubbleUser: '#3c3836', borderMain: '#504945', borderSubtle: '#3c3836', textMain: '#ebdbb2', textMuted: '#d5c4a1', textDim: '#a89984' },
    studio_light:{ bgApp: '#f4f6f9', bgSidebar: '#e8ecf3', bgHeader: '#edf1f7', bgCard: '#ffffff', bgCardHover: '#f1f5f9', bgInput: '#ffffff', bgBubbleUser: themeObj.accent || '#0284c7', borderMain: '#cbd5e1', borderSubtle: '#e2e8f0', textMain: '#0f172a', textMuted: '#475569', textDim: '#64748b' }
  };

  const tone = tonePresets[themeObj.baseTone] || tonePresets.obsidian;
  const acc = themeObj.accent || '#10b981';

  styleEl.textContent = `
    .skin-custom {
      --bg-app: ${tone.bgApp};
      --bg-sidebar: ${tone.bgSidebar};
      --bg-header: ${tone.bgHeader};
      --bg-card: ${tone.bgCard};
      --bg-card-hover: ${tone.bgCardHover};
      --bg-input: ${tone.bgInput};
      --bg-bubble-user: ${tone.bgBubbleUser};
      --text-bubble-user: #ffffff;
      --border-main: ${tone.borderMain};
      --border-subtle: ${tone.borderSubtle};
      --accent: ${acc};
      --accent-hover: ${acc};
      --accent-subtle: ${acc}26;
      --accent-text: #000000;
      --accent-glow: 0 0 20px ${acc}59;
      --text-main: ${tone.textMain};
      --text-muted: ${tone.textMuted};
      --text-dim: ${tone.textDim};
      --lcd-bg: #000000;
      --lcd-text: ${acc};
      --code-bg: ${tone.bgApp};
      --code-border: ${tone.borderMain};
    }
  `;
}

export function setSkin(skinName) {
  const body = document.getElementById('app-body');
  const isLight = skinName === 'aqua' || (skinName === 'custom' && State.customThemeState.baseTone === 'studio_light');

  const classes = body.className.split(' ').filter(c => !c.startsWith('skin-'));
  classes.push(`skin-${skinName}`);
  if (isLight) {
    classes.push('skin-light-mode');
  }
  body.className = classes.join(' ');
  localStorage.setItem('tutor_skin', skinName);

  if (isLight) {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }

  // Update badge in modal
  const badge = document.getElementById('current-theme-badge');
  if (badge) {
    const found = THEME_REGISTRY.find(t => t.id === skinName);
    badge.textContent = found ? found.name : (skinName === 'custom' ? 'Custom' : skinName);
  }

  renderThemeSettingsUI();
  loadThreadsList();
  lucide.createIcons();
}

export function renderThemeSettingsUI() {
  const grid = document.getElementById('theme-gallery-grid');
  if (!grid) return;

  const activeSkin = localStorage.getItem('tutor_skin') || 'classic';
  const filtered = THEME_REGISTRY.filter(t => {
    if (State.currentThemeFilter === 'all') return true;
    if (State.currentThemeFilter === 'dark') return t.category === 'dark' || t.category === 'cyber';
    if (State.currentThemeFilter === 'retro') return t.category === 'retro';
    if (State.currentThemeFilter === 'light') return t.category === 'light';
    return true;
  });

  let html = '';

  // If a custom theme is saved, show it at the top when relevant
  const hasCustom = Boolean(localStorage.getItem('tutor_custom_theme'));
  if (hasCustom && (State.currentThemeFilter === 'all' || State.currentThemeFilter === 'dark')) {
    const isCustomActive = activeSkin === 'custom';
    html += `
      <div onclick="setSkin('custom')"
           style="${isCustomActive ? 'border-color: var(--accent) !important; outline: 2px solid var(--accent);' : ''}"
           class="p-3 rounded-xl border cursor-pointer transition-all ${isCustomActive ? 'theme-card font-semibold shadow-sm' : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-600'} flex flex-col justify-between gap-2 shadow-sm group app-no-drag">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <i data-lucide="sliders-horizontal" class="w-3.5 h-3.5"></i>
            </div>
            <div>
              <div class="font-bold text-zinc-100 flex items-center gap-1.5 text-xs">
                <span>Personalizado (Custom)</span>
                ${isCustomActive ? `<span class="text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold border" style="background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);">Ativo</span>` : ''}
              </div>
              <div class="text-[10px] text-zinc-400">Sua paleta customizada no Studio</div>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <span class="w-3.5 h-3.5 rounded-full border border-black/40 shadow-sm" style="background-color: ${State.customThemeState.accent};"></span>
          </div>
        </div>
      </div>
    `;
  }

  // Render standard registry cards
  filtered.forEach(t => {
    const isActive = activeSkin === t.id;
    html += `
      <div onclick="setSkin('${t.id}')"
           style="${isActive ? 'border-color: var(--accent) !important; outline: 2px solid var(--accent);' : ''}"
           class="p-3 rounded-xl border cursor-pointer transition-all ${isActive ? 'theme-card font-semibold shadow-sm' : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-600'} flex flex-col justify-between gap-2 shadow-sm group app-no-drag">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-200 border" style="background-color: ${t.colors.bg}; border-color: ${t.colors.border}; color: ${t.colors.accent};">
              <i data-lucide="${t.icon}" class="w-3.5 h-3.5"></i>
            </div>
            <div>
              <div class="font-bold text-zinc-100 flex items-center gap-1.5 text-xs">
                <span>${t.name}</span>
                ${isActive ? `<span class="text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold border" style="background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);">Ativo</span>` : ''}
              </div>
              <span class="text-[9px] text-zinc-400 font-mono">${t.badge}</span>
            </div>
          </div>
          <!-- Swatches preview -->
          <div class="flex items-center gap-1 shrink-0 p-1 rounded-lg bg-black/40 border border-zinc-800/80">
            <span class="w-2.5 h-2.5 rounded-full border border-white/10" style="background-color: ${t.colors.bg};" title="Background"></span>
            <span class="w-2.5 h-2.5 rounded-full border border-white/10" style="background-color: ${t.colors.card};" title="Card"></span>
            <span class="w-2.5 h-2.5 rounded-full shadow-sm" style="background-color: ${t.colors.accent}; box-shadow: 0 0 6px ${t.colors.accent};" title="Accent"></span>
          </div>
        </div>
        <div class="text-[11px] text-zinc-400 line-clamp-1 leading-snug">
          ${t.desc}
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
  lucide.createIcons();
}

export function filterThemes(cat) {
  State.currentThemeFilter = cat;
  const categories = ['all', 'dark', 'retro', 'light'];
  categories.forEach(c => {
    const btn = document.getElementById(`theme-cat-${c}`);
    if (btn) {
      if (c === cat) {
        btn.className = "px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-sm cursor-pointer app-no-drag";
        btn.style.backgroundColor = "var(--accent-subtle)";
        btn.style.color = "var(--accent)";
        btn.style.borderColor = "var(--accent)";
      } else {
        btn.className = "px-2 py-0.5 rounded-md text-[10px] font-bold text-zinc-400 hover:text-white border border-transparent cursor-pointer app-no-drag";
        btn.style.backgroundColor = "";
        btn.style.color = "";
        btn.style.borderColor = "";
      }
    }
  });
  renderThemeSettingsUI();
}

export function toggleCustomThemeStudio() {
  const body = document.getElementById('custom-theme-studio-body');
  const chevron = document.getElementById('custom-studio-chevron');
  const label = document.getElementById('custom-studio-toggle-label');
  if (!body) return;
  const isHidden = body.classList.contains('hidden');
  if (isHidden) {
    body.classList.remove('hidden');
    if (chevron) chevron.style.transform = 'rotate(180deg)';
    if (label) label.textContent = 'Collapse';
  } else {
    body.classList.add('hidden');
    if (chevron) chevron.style.transform = '';
    if (label) label.textContent = 'Expand';
  }
}

export function setCustomBaseTone(tone) {
  State.customThemeState.baseTone = tone;
  injectCustomThemeCSS(State.customThemeState);
  setSkin('custom');
}

export function updateCustomAccentFromPicker(hex) {
  State.customThemeState.accent = hex;
  const hexInput = document.getElementById('custom-accent-hex');
  const picker = document.getElementById('custom-accent-picker');
  if (hexInput) hexInput.value = hex;
  if (picker) picker.value = hex;
  injectCustomThemeCSS(State.customThemeState);
  setSkin('custom');
}

export function saveAndApplyCustomTheme() {
  localStorage.setItem('tutor_custom_theme', JSON.stringify(State.customThemeState));
  injectCustomThemeCSS(State.customThemeState);
  setSkin('custom');
  alert("Custom theme saved and activated successfully!");
}

export function exportCurrentThemeCSS() {
  const activeSkin = localStorage.getItem('tutor_skin') || 'classic';
  const el = document.getElementById('app-body');
  const computed = window.getComputedStyle(el);
  const vars = [
    '--bg-app', '--bg-sidebar', '--bg-header', '--bg-card', '--bg-input',
    '--bg-bubble-user', '--border-main', '--accent', '--text-main', '--text-muted'
  ];
  let css = `/* Tutor OS Theme: ${activeSkin} */\n.skin-${activeSkin} {\n`;
  vars.forEach(v => {
    css += `  ${v}: ${computed.getPropertyValue(v).trim()};\n`;
  });
  css += `}`;

  navigator.clipboard.writeText(css).then(() => {
    alert("Theme CSS variables copied to the clipboard!");
  }).catch(e => {
    prompt("Copy the CSS variables below:", css);
  });
}

// --- inline-handler surface (onclick/onchange="..." targets) ---
window.changeFontSize = changeFontSize;
window.setFontSize = setFontSize;
window.setSkin = setSkin;
window.filterThemes = filterThemes;
window.toggleCustomThemeStudio = toggleCustomThemeStudio;
window.setCustomBaseTone = setCustomBaseTone;
window.updateCustomAccentFromPicker = updateCustomAccentFromPicker;
window.saveAndApplyCustomTheme = saveAndApplyCustomTheme;
window.exportCurrentThemeCSS = exportCurrentThemeCSS;
