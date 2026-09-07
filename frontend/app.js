    lucide.createIcons();

    const API_BASE = (window.location.protocol === 'file:' || window.location.origin.includes('tauri') || (window.location.hostname === 'localhost' && window.location.port !== '4115'))
      ? 'http://localhost:4115'
      : '';

    // Global UI & Workspace State
    let currentPreviewFile = { slug: null, path: null, content: "", isArchived: false };
    let pendingDeleteTarget = { type: null, slug: null, path: null, isArchived: false };

    // 1. Marked.js configuration
    marked.setOptions({
      highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      },
      gfm: true,
      breaks: true
    });

    // 2. Font Scaling & Preferences
    let currentFontSize = parseInt(localStorage.getItem('tutor_font_size') || '18', 10);
    function applyFontSize(size) {
      currentFontSize = Math.max(14, Math.min(26, size));
      document.getElementById('html-root').style.fontSize = `${currentFontSize}px`;
      const label = document.getElementById('font-size-label');
      if (label) label.textContent = `${currentFontSize}px`;
      const settingsVal = document.getElementById('settings-font-val');
      if (settingsVal) settingsVal.textContent = `${currentFontSize}px`;
      localStorage.setItem('tutor_font_size', currentFontSize.toString());

      // Update active state on modal buttons
      [14, 16, 18, 20, 22].forEach(sz => {
        const btn = document.getElementById(`font-btn-${sz}`);
        if (btn) {
          if (sz === currentFontSize) {
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
    function changeFontSize(delta) { applyFontSize(currentFontSize + delta); }
    function setFontSize(size) { applyFontSize(size); }
    applyFontSize(currentFontSize);

    // =========================================================================
    // 3. THEME REGISTRY & DYNAMIC THEME ENGINE
    // =========================================================================
    const THEME_REGISTRY = [
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

    let currentThemeFilter = 'all';
    let customThemeState = {
      baseTone: 'obsidian',
      accent: '#10b981'
    };

    // Initialize custom theme from localStorage if available
    function loadSavedCustomTheme() {
      try {
        const saved = localStorage.getItem('tutor_custom_theme');
        if (saved) {
          const parsed = JSON.parse(saved);
          customThemeState = { ...customThemeState, ...parsed };
          injectCustomThemeCSS(customThemeState);
        }
      } catch (e) {
        console.warn("Could not load custom theme:", e);
      }
    }

    function injectCustomThemeCSS(themeObj) {
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

    function setSkin(skinName) {
      const body = document.getElementById('app-body');
      const isLight = skinName === 'aqua' || (skinName === 'custom' && customThemeState.baseTone === 'studio_light');

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

    function renderThemeSettingsUI() {
      const grid = document.getElementById('theme-gallery-grid');
      if (!grid) return;

      const activeSkin = localStorage.getItem('tutor_skin') || 'classic';
      const filtered = THEME_REGISTRY.filter(t => {
        if (currentThemeFilter === 'all') return true;
        if (currentThemeFilter === 'dark') return t.category === 'dark' || t.category === 'cyber';
        if (currentThemeFilter === 'retro') return t.category === 'retro';
        if (currentThemeFilter === 'light') return t.category === 'light';
        return true;
      });

      let html = '';

      // If a custom theme is saved, show it at the top when relevant
      const hasCustom = Boolean(localStorage.getItem('tutor_custom_theme'));
      if (hasCustom && (currentThemeFilter === 'all' || currentThemeFilter === 'dark')) {
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
                <span class="w-3.5 h-3.5 rounded-full border border-black/40 shadow-sm" style="background-color: ${customThemeState.accent};"></span>
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

    function filterThemes(cat) {
      currentThemeFilter = cat;
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

    function toggleCustomThemeStudio() {
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

    function setCustomBaseTone(tone) {
      customThemeState.baseTone = tone;
      injectCustomThemeCSS(customThemeState);
      setSkin('custom');
    }

    function updateCustomAccentFromPicker(hex) {
      customThemeState.accent = hex;
      const hexInput = document.getElementById('custom-accent-hex');
      const picker = document.getElementById('custom-accent-picker');
      if (hexInput) hexInput.value = hex;
      if (picker) picker.value = hex;
      injectCustomThemeCSS(customThemeState);
      setSkin('custom');
    }

    function saveAndApplyCustomTheme() {
      localStorage.setItem('tutor_custom_theme', JSON.stringify(customThemeState));
      injectCustomThemeCSS(customThemeState);
      setSkin('custom');
      alert("Custom theme saved and activated successfully!");
    }

    function exportCurrentThemeCSS() {
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

    // 3.5 Agent Switcher Handler
    // Switching the active agent starts a fresh session scoped to it, rather
    // than mixing a different agent identity into an existing thread's history.
    function onAgentChanged() {
      const select = document.getElementById('agent-selector');
      if (!select) return;
      const agentId = select.value;
      updateConductorBadge(AGENT_IDLE_LABEL[agentId] || AGENT_IDLE_LABEL.tutor, false);
      createNewThread(agentId);
    }

    // 3.6 A2A Delegation Transparency & Conductor Indicator
    function updateConductorBadge(labelText, isActive = false) {
      const label = document.getElementById('conductor-agent-label');
      const dot = document.getElementById('conductor-pulse-dot');
      if (label) label.textContent = labelText;
      if (dot) {
        if (isActive) {
          dot.className = "w-2.5 h-2.5 rounded-full animate-ping bg-amber-400";
        } else {
          dot.className = "w-2 h-2 rounded-full animate-pulse";
        }
      }
    }

    function getAgentDelegationInfo(toolName, skillId) {
      // Skills (challenger/teacher/reviewer/...) are always invoked through a
      // single framework tool called "load_capability" — the real skill name
      // only exists in its `id` argument (passed here as `skillId`), never in
      // `toolName`. Without this, every Skill call falls through to the
      // generic "System / Workspace Tool Execution" branch below.
      const norm = (skillId || toolName || "").toLowerCase().replace(/[-_]/g, '');
      if (norm.includes('assigner') || norm.includes('assignment')) {
        return {
          isDelegation: true,
          agentName: 'Assigner',
          role: 'Assignment Engine (Predict ➔ Measure ➔ Mutate ➔ Explain)',
          color: 'emerald',
          iconEmoji: '📋',
          headerText: '🧭 Tutor ➔ 📋 Assigner (Creating Challenge...)',
        };
      }
      if (norm.includes('challenger')) {
        return {
          isDelegation: true,
          agentName: 'Challenger',
          role: 'Mental Model Breaker (Attacks Concurrency & Failures)',
          color: 'rose',
          iconEmoji: '⚔️',
          headerText: '🧭 Tutor ➔ ⚔️ Challenger (Attacking Model...)',
        };
      }
      if (norm.includes('reviewer')) {
        return {
          isDelegation: true,
          agentName: 'Reviewer',
          role: 'Judgment Auditor (Trade-offs & Evidence Validation)',
          color: 'purple',
          iconEmoji: '🔍',
          headerText: '🧭 Tutor ➔ 🔍 Reviewer (Auditing Judgment...)',
        };
      }
      if (norm.includes('teacher')) {
        return {
          isDelegation: true,
          agentName: 'Teacher',
          role: 'Just-in-Time Socratic Teaching (Physical Intuition & Models)',
          color: 'amber',
          iconEmoji: '💡',
          headerText: '🧭 Tutor ➔ 💡 Teacher (Explaining JIT...)',
        };
      }
      if (norm.includes('planner')) {
        return {
          isDelegation: true,
          agentName: 'Planner',
          role: 'Phase & Curriculum Planning',
          color: 'blue',
          iconEmoji: '🗺️',
          headerText: '🧭 Tutor ➔ 🗺️ Planner (Planning Phase...)',
        };
      }
      if (norm.includes('scaffolder')) {
        return {
          isDelegation: true,
          agentName: 'Scaffolder',
          role: 'Tracer-Bullet Scaffolding',
          color: 'teal',
          iconEmoji: '🏗️',
          headerText: '🧭 Tutor ➔ 🏗️ Scaffolder (Scaffolding...)',
        };
      }
      if (norm.includes('breaker')) {
        return {
          isDelegation: true,
          agentName: 'Breaker',
          role: 'Edge-Case & Failure-Mode Breaker',
          color: 'red',
          iconEmoji: '💥',
          headerText: '🧭 Tutor ➔ 💥 Breaker (Breaking Edges...)',
        };
      }
      if (norm.includes('researcher') || norm.includes('arxiv')) {
        return {
          isDelegation: true,
          agentName: 'Researcher',
          role: 'arXiv Research Specialist (Primary Literature)',
          color: 'sky',
          iconEmoji: '📚',
          headerText: '🧭 Tutor ➔ 📚 Researcher (Researching arXiv...)',
        };
      }
      if (norm.includes('meta')) {
        return {
          isDelegation: false,
          agentName: 'Meta-Learning',
          role: 'NOW, Arc, and Project Synchronization',
          color: 'teal',
          iconEmoji: '🧭',
          headerText: '🧭 Tutor (Syncing Meta-Learn...)',
        };
      }
      if (norm.includes('arc') || norm.includes('capability')) {
        return {
          isDelegation: false,
          agentName: 'Judgment Arcs',
          role: 'Goal Management & Evidence Verification',
          color: 'emerald',
          iconEmoji: '🎯',
          headerText: '🧭 Tutor (Verifying Evidence...)',
        };
      }
      const displayName = skillId || toolName;
      return {
        isDelegation: false,
        agentName: `${displayName}()`,
        role: 'System / Workspace Tool Execution',
        color: 'zinc',
        iconEmoji: '⚙️',
        headerText: `🧭 Tutor (${displayName}...)`,
      };
    }

    // Renders one persisted (already-completed) A2A/Skill/tool call as a card,
    // in the same shape as the live "tool-result" step built in sendChatMessage.
    // Used to replay delegation/skill-call transparency after a page reload,
    // since tool-call/tool-result SSE frames only used to exist in the live DOM.
    function buildToolEventCardHTML(ev) {
      const toolName = ev.toolName || "tool";
      const info = getAgentDelegationInfo(toolName, ev.skillId);
      const isError = Boolean(ev.isError);
      const args = ev.args || {};
      return `
        <div class="p-3 rounded-2xl theme-card border ${isError ? 'border-red-500/50 bg-red-950/30 text-red-300' : 'theme-border'} text-xs transition-all shadow-md space-y-2 my-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 font-bold min-w-0">
              <span class="text-xs inline-flex items-center justify-center shrink-0 select-none">${isError ? '⚠️' : info.iconEmoji}</span>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-xs ${isError ? 'text-red-300' : 'theme-accent'}">${info.isDelegation ? 'A2A:' : 'Executed:'} <b>${escapeHtml(info.agentName)}</b></span>
                <span class="text-[10px] font-normal hidden sm:inline" style="color: var(--text-muted);">(${escapeHtml(info.role)})</span>
              </div>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 font-mono shrink-0" style="${isError ? 'color: #f87171; background-color: rgba(239, 68, 68, 0.15); border-color: #ef4444;' : 'background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);'}">
              <i data-lucide="${isError ? 'alert-triangle' : 'check'}" class="w-3 h-3"></i>
              <span>${isError ? 'Failed' : 'Completed'}</span>
            </span>
          </div>
          <details class="text-[10px] font-code pt-1 border-t theme-border">
            <summary class="cursor-pointer hover:text-[var(--text-main)] select-none flex items-center justify-between" style="color: var(--text-muted);">
              <span>Inspect output &amp; payload for <b>${escapeHtml(toolName)}</b></span>
              <span class="text-[9px] font-mono" style="color: var(--text-dim);">[expand]</span>
            </summary>
            <div class="mt-2 space-y-2">
              ${Object.keys(args).length > 0 ? `
                <div>
                  <span class="font-sans font-bold" style="color: var(--text-dim);">Input:</span>
                  <pre class="mt-0.5 p-2 rounded overflow-x-auto border font-code text-xs" style="background-color: var(--code-bg); border-color: var(--code-border); color: var(--text-muted);">${escapeHtml(JSON.stringify(args, null, 2))}</pre>
                </div>
              ` : ''}
              <div>
                <span class="font-sans font-bold" style="color: var(--text-dim);">Output:</span>
                <pre class="mt-0.5 p-2 rounded overflow-x-auto border font-code text-xs" style="background-color: var(--code-bg); border-color: var(--code-border); color: ${isError ? '#fca5a5' : 'var(--text-main)'};">${escapeHtml(typeof ev.result === 'object' ? JSON.stringify(ev.result, null, 2) : String(ev.result))}</pre>
              </div>
            </div>
          </details>
        </div>
      `;
    }

    // 4. Sidebar Tabs Switching
    function setSidebarTab(tabName) {
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

    function toggleSidebar() {
      const sidebar = document.getElementById('app-sidebar');
      if (sidebar) sidebar.classList.toggle('hidden');
    }

    // 5. Scroll Management
    const chatFeed = document.getElementById('chat-feed');
    const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
    let userScrolledUp = false;

    chatFeed.addEventListener('scroll', () => {
      const isAtBottom = chatFeed.scrollHeight - chatFeed.scrollTop - chatFeed.clientHeight < 120;
      userScrolledUp = !isAtBottom;
      if (userScrolledUp) {
        scrollBottomBtn.classList.remove('hidden');
      } else {
        scrollBottomBtn.classList.add('hidden');
      }
    });

    function scrollToBottom() {
      chatFeed.scrollTop = chatFeed.scrollHeight;
      userScrolledUp = false;
      scrollBottomBtn.classList.add('hidden');
    }

    function autoScroll() {
      if (!userScrolledUp) {
        chatFeed.scrollTop = chatFeed.scrollHeight;
      }
    }

    // 6. Textarea Auto-Resize
    function autoResizeTextarea(el) {
      el.style.height = 'auto';
      el.style.height = (el.scrollHeight) + 'px';
    }

    function handleInputKeydown(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('chat-form').dispatchEvent(new Event('submit'));
      }
    }

    function quickPrompt(text) {
      const input = document.getElementById('chat-input');
      input.value = text;
      autoResizeTextarea(input);
      document.getElementById('chat-form').dispatchEvent(new Event('submit'));
    }


    // 7. Sessions, Threads & Full Chat History State
    let activeThreadId = localStorage.getItem('tutor_active_thread') || 'session-principal';
    let currentAbortController = null;
    let activeAgentFilter = null; // null = show all
    let nowCardCollapsed = false;

    // Agent color/label map
    // Mirrors the backend's AGENTS dict (server.py) exactly — every id it can
    // ever tag a thread/message with, whether reachable from the selector
    // dropdown directly (tutor/pair/architect) or only via A2A/Skills.
    const AGENT_META = {
      tutor:      { label: 'Tutor',      color: 'emerald' },
      pair:       { label: 'Pair',       color: 'sky'     },
      architect:  { label: 'Architect',  color: 'violet'  },
      assigner:   { label: 'Assigner',   color: 'lime'    },
      researcher: { label: 'Research',   color: 'amber'   },
      challenger: { label: 'Challenger', color: 'rose'    },
      reviewer:   { label: 'Reviewer',   color: 'orange'  },
      teacher:    { label: 'Teacher',    color: 'yellow'  },
      planner:    { label: 'Planner',    color: 'blue'    },
      scaffolder: { label: 'Scaffold',   color: 'teal'    },
      breaker:    { label: 'Breaker',    color: 'red'     },
    };

    // Idle (non-delegating) conductor badge label per directly-selectable agent.
    const AGENT_IDLE_LABEL = {
      tutor: '🧭 Tutor (Senior Navigator)',
      pair: '🤝 Pair (Programming Partner)',
      architect: '🏛️ Architect (Project & Career Strategist)',
    };

    function currentIdleConductorLabel() {
      const select = document.getElementById('agent-selector');
      const agentId = select ? select.value : 'tutor';
      return AGENT_IDLE_LABEL[agentId] || AGENT_IDLE_LABEL.tutor;
    }

    function agentBadgeClasses(agentId, small = false) {
      const meta = AGENT_META[agentId] || { label: agentId, color: 'zinc' };
      const c = meta.color;
      const sz = small ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5';
      return `${sz} rounded-full bg-${c}-950/80 text-${c}-300 border border-${c}-800 font-mono font-bold`;
    }

    function toggleNowCard() {
      nowCardCollapsed = !nowCardCollapsed;
      const card = document.getElementById('quick-now-card');
      const chevron = document.getElementById('now-card-chevron');
      if (nowCardCollapsed) {
        card.style.display = 'none';
        if (chevron) chevron.style.transform = 'rotate(-90deg)';
      } else {
        card.style.display = '';
        if (chevron) chevron.style.transform = '';
      }
    }

    let threadSearchQuery = '';

    function handleThreadSearch(val) {
      threadSearchQuery = (val || '').toLowerCase().trim();
      const clearBtn = document.getElementById('thread-search-clear');
      if (clearBtn) {
        if (threadSearchQuery) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }
      loadThreadsList();
    }

    function clearThreadSearch() {
      const input = document.getElementById('thread-search-input');
      if (input) input.value = '';
      handleThreadSearch('');
    }

    function formatRelativeTime(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) return 'Now';
      if (diffMin < 60) return `${diffMin}m`;
      if (diffHour < 24) return `${diffHour}h`;
      if (diffDay === 1) return 'Yesterday';
      if (diffDay < 7) return `${diffDay}d`;
      return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    }

    function getDateGroup(dateStr) {
      if (!dateStr) return 'Older';
      const d = new Date(dateStr);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      const threadDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (threadDay.getTime() === today.getTime()) return 'Today';
      if (threadDay.getTime() === yesterday.getTime()) return 'Yesterday';
      const diffDays = Math.floor((today - threadDay) / 86400000);
      if (diffDays <= 7) return 'This week';
      return 'Older';
    }

    async function renameThread(threadId, currentTitle) {
      const newTitle = prompt('Rename session:', currentTitle);
      if (!newTitle || newTitle === currentTitle) return;
      try {
        await fetch(`${API_BASE}/api/thread/rename`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId, title: newTitle }),
        });
        loadThreadsList();
        if (threadId === activeThreadId) {
          const el = document.getElementById('active-thread-title-text');
          if (el) el.textContent = newTitle;
        }
      } catch (e) { console.error('rename error', e); }
    }

    function promptRenameActiveThread() {
      if (!activeThreadId) return;
      const el = document.getElementById('active-thread-title-text');
      const current = el ? el.textContent : 'Session';
      renameThread(activeThreadId, current);
    }

    async function exportCurrentThreadMarkdown() {
      if (!activeThreadId) return;
      try {
        const res = await fetch(`${API_BASE}/api/thread/export?threadId=${encodeURIComponent(activeThreadId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tutor-session-${activeThreadId}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (err) {
        alert(`Error exporting conversation: ${err.message}`);
      }
    }

    async function copyCurrentThreadTranscript() {
      if (!activeThreadId) return;
      try {
        const res = await fetch(`${API_BASE}/api/thread/export?threadId=${encodeURIComponent(activeThreadId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        await navigator.clipboard.writeText(text);
        const btnSpan = document.querySelector('[onclick="copyCurrentThreadTranscript()"] span');
        if (btnSpan) {
          const orig = btnSpan.textContent;
          btnSpan.textContent = 'Copied! ✓';
          setTimeout(() => btnSpan.textContent = orig, 1800);
        }
      } catch (err) {
        alert(`Error copying conversation: ${err.message}`);
      }
    }

    async function promptClearActiveThread() {
      if (!activeThreadId) return;
      if (!confirm('Clear all messages in this session while keeping the active topic?')) return;
      try {
        const res = await fetch(`${API_BASE}/api/thread/clear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId: activeThreadId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await switchThread(activeThreadId);
        await loadThreadsList();
      } catch (err) {
        alert(`Error clearing conversation: ${err.message}`);
      }
    }

    async function loadThreadsList() {
      const container = document.getElementById('threads-list');
      const pillsContainer = document.getElementById('agent-filter-pills');
      try {
        const res = await fetch(`${API_BASE}/api/threads`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        let threads = data.threads || [];

        if (threads.length === 0) {
          container.innerHTML = `<div class="text-[11px] text-zinc-500 p-2">No sessions recorded.</div>`;
          return;
        }

        if (!threads.find(t => t.id === activeThreadId)) {
          activeThreadId = threads[0].id;
          localStorage.setItem('tutor_active_thread', activeThreadId);
        }

        // Build agent filter pills
        const agentIds = [...new Set(threads.map(t => t.metadata?.agentId).filter(Boolean))];
        if (pillsContainer && agentIds.length > 1) {
          pillsContainer.innerHTML = agentIds.map(aid => {
            const meta = AGENT_META[aid] || { label: aid, color: 'zinc' };
            const isActive = activeAgentFilter === aid;
            const c = meta.color;
            return `<button onclick="toggleAgentFilter('${aid}')" class="text-[9px] px-1.5 py-0.5 rounded-full border font-mono font-bold transition-all cursor-pointer app-no-drag ${isActive ? `bg-${c}-500 text-black border-${c}-400` : `bg-${c}-950/60 text-${c}-300 border-${c}-800 hover:bg-${c}-900`}">${meta.label}</button>`;
          }).join('');
          lucide.createIcons();
        } else if (pillsContainer) {
          pillsContainer.innerHTML = '';
        }

        // Apply agent filter
        if (activeAgentFilter) {
          threads = threads.filter(t => (t.metadata?.agentId || 'tutor') === activeAgentFilter);
        }

        // Apply search query filter
        if (threadSearchQuery) {
          threads = threads.filter(t => {
            const title = (t.title || '').toLowerCase();
            const aid = (t.metadata?.agentId || '').toLowerCase();
            return title.includes(threadSearchQuery) || aid.includes(threadSearchQuery);
          });
        }

        if (threads.length === 0) {
          container.innerHTML = `<div class="text-[11px] text-zinc-500 p-3 text-center">No sessions found for "${escapeHtml(threadSearchQuery)}".</div>`;
          return;
        }

        // Group by date
        const groups = {};
        const groupOrder = ['Today', 'Yesterday', 'This week', 'Older'];
        threads.forEach(t => {
          const g = getDateGroup(t.updatedAt || t.createdAt);
          if (!groups[g]) groups[g] = [];
          groups[g].push(t);
        });

        let html = '';
        groupOrder.forEach(group => {
          if (!groups[group]) return;
          html += `<div class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1 pt-2 pb-0.5 select-none">${group}</div>`;
          groups[group].forEach(t => {
            const isActive = t.id === activeThreadId;
            const agentId = t.metadata?.agentId || 'tutor';
            const meta = AGENT_META[agentId] || { label: agentId, color: 'zinc' };
            const displayTitle = escapeHtml(t.title || 'Session');
            const safeId = escapeHtml(t.id);
            const msgCount = t.messageCount || 0;
            const timeAgo = formatRelativeTime(t.updatedAt || t.createdAt);

            html += `
              <div data-thread-id="${safeId}"
                   data-thread-title="${displayTitle}"
                   title="Click to open conversation / Double-click to rename"
                   class="p-2 rounded-lg ${isActive
                     ? 'theme-card border theme-border font-semibold shadow-sm text-zinc-100 ring-1 ring-[var(--accent)]/30'
                     : 'bg-transparent hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-transparent'
                   } flex items-center justify-between cursor-pointer transition-all group app-no-drag select-none"
                   data-tauri-drag-region="false">
                <div class="flex items-center gap-2 truncate flex-1 min-w-0 pr-1 pointer-events-none">
                  <span class="w-2 h-2 rounded-full ${isActive ? 'theme-bg-accent ring-2 ring-[var(--accent)]/30' : 'bg-zinc-600'} shrink-0"></span>
                  <div class="truncate flex-1 min-w-0">
                    <div class="truncate text-xs font-sans leading-tight">${displayTitle}</div>
                    <div class="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 mt-0.5">
                      <span>${msgCount} ${msgCount === 1 ? 'msg' : 'msgs'}</span>
                      ${timeAgo ? `<span>• ${timeAgo}</span>` : ''}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button data-action="rename-thread"
                          data-thread-id="${safeId}"
                          data-thread-title="${displayTitle}"
                          title="Rename Session"
                          class="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer app-no-drag"
                          data-tauri-drag-region="false">
                    <i data-lucide="edit-2" class="w-3.5 h-3.5 pointer-events-none"></i>
                  </button>
                  <button data-action="export-thread"
                          data-thread-id="${safeId}"
                          title="Export Markdown"
                          class="p-1 text-zinc-400 hover:text-[var(--accent)] hover:bg-zinc-800 rounded transition-colors cursor-pointer app-no-drag"
                          data-tauri-drag-region="false">
                    <i data-lucide="download" class="w-3.5 h-3.5 pointer-events-none"></i>
                  </button>
                  <button data-action="delete-thread"
                          data-thread-id="${safeId}"
                          data-thread-title="${displayTitle}"
                          title="Delete Session"
                          class="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer app-no-drag"
                          data-tauri-drag-region="false">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
                  </button>
                </div>
              </div>
            `;
          });
        });

        container.innerHTML = html;
        lucide.createIcons();
      } catch (err) {
        console.error('Threads load error:', err);
        if (container) {
          container.innerHTML = `
            <div class="p-3 text-center space-y-2">
              <div class="text-xs text-amber-400">Backend server connecting...</div>
              <button onclick="loadThreadsList()" class="text-[10px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border theme-border cursor-pointer">Reconnect</button>
            </div>
          `;
        }
      }
    }

    function toggleAgentFilter(agentId) {
      activeAgentFilter = (activeAgentFilter === agentId) ? null : agentId;
      loadThreadsList();
    }

    async function switchThread(threadId) {
      if (!threadId) return;
      activeThreadId = threadId;
      localStorage.setItem('tutor_active_thread', activeThreadId);
      setSidebarTab('chat');
      loadThreadsList();

      const titleEl = document.getElementById('active-thread-title-text');
      const countEl = document.getElementById('active-thread-msg-count');

      const messagesContainer = document.getElementById('messages-container');
      messagesContainer.innerHTML = `
        <div class="p-4 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
          <i data-lucide="loader-2" class="w-4 h-4 animate-spin theme-accent"></i>
          <span>Loading conversation history...</span>
        </div>
      `;
      lucide.createIcons();

      try {
        const res = await fetch(`${API_BASE}/api/thread/messages?threadId=${encodeURIComponent(threadId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const messages = data.messages || [];
        const threadAgentId = data.agentId || 'tutor';
        const agentSelect = document.getElementById('agent-selector');
        if (agentSelect && AGENT_IDLE_LABEL[threadAgentId]) {
          agentSelect.value = threadAgentId;
          updateConductorBadge(AGENT_IDLE_LABEL[threadAgentId], false);
        }
        const agentLabel = (AGENT_META[threadAgentId]?.label || 'Tutor').toUpperCase();
        const toolEventsByMessageId = {};
        (data.toolEvents || []).forEach(ev => {
          if (!ev.messageId) return;
          (toolEventsByMessageId[ev.messageId] = toolEventsByMessageId[ev.messageId] || []).push(ev);
        });

        if (countEl) countEl.textContent = `• ${messages.length} ${messages.length === 1 ? 'msg' : 'msgs'}`;

        if (messages.length === 0) {
          if (titleEl) titleEl.textContent = "New Session";
          messagesContainer.innerHTML = `
            <div class="flex items-start gap-3.5">
              <div class="w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5" style="background-color: var(--accent); color: var(--accent-text); box-shadow: 0 2px 8px var(--accent-subtle);">
                ✦
              </div>
              <div class="flex-1 space-y-2">
                <div class="font-semibold text-sm text-zinc-200">Tutor Navigator</div>
                <div class="text-base text-zinc-300 leading-relaxed prose-chat">
                  <p>Active session started. Send a message to move forward on the project or capability arcs.</p>
                </div>
              </div>
            </div>
          `;
          return;
        }

        // Set title from first user message or thread list
        const firstUser = messages.find(m => m.role === 'user');
        if (firstUser && titleEl) {
          const autoTitle = firstUser.text.slice(0, 36).replace(/[\r\n]+/g, ' ') + (firstUser.text.length > 36 ? '...' : '');
          titleEl.textContent = autoTitle;
        }

        messagesContainer.innerHTML = '';
        messages.forEach(m => {
          if (m.role === 'user') {
            messagesContainer.appendChild(buildUserMessageBlock(m.id || '', m.text || ''));
          } else {
            const bubbleId = `hist-bubble-${m.id || Math.random().toString(36).slice(2, 7)}`;
            const toolEvents = (m.id && toolEventsByMessageId[m.id]) || [];
            const stepsHtml = toolEvents.map(buildToolEventCardHTML).join('');
            const assistantBlock = document.createElement('div');
            assistantBlock.className = "flex items-start gap-3.5";
            assistantBlock.innerHTML = `
              <div class="w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5" style="background-color: var(--accent); color: var(--accent-text); box-shadow: 0 2px 8px var(--accent-subtle);">
                ✦
              </div>
              <div class="flex-1 space-y-2 max-w-2xl">
                <div class="font-semibold text-sm text-zinc-200 flex items-center gap-2">
                  <span>${escapeHtml(agentLabel)}</span>
                  <span class="text-xs text-zinc-500 font-normal">deepseek-v4-flash</span>
                </div>
                ${stepsHtml ? `<div class="space-y-1.5">${stepsHtml}</div>` : ''}
                <div id="${bubbleId}" class="text-base text-zinc-300 leading-relaxed prose-chat font-sans">
                  ${renderMarkdown(m.text || '')}
                </div>
                <div class="flex items-center gap-3 pt-1 text-xs text-zinc-500">
                  <button onclick="copyMessageText('${bubbleId}', this)" class="hover:text-zinc-300 flex items-center gap-1 cursor-pointer">
                    <i data-lucide="copy" class="w-3.5 h-3.5 pointer-events-none"></i>
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            `;
            messagesContainer.appendChild(assistantBlock);
          }
        });

        lucide.createIcons();
        scrollToBottom();
      } catch (err) {
        messagesContainer.innerHTML = `
          <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center space-y-2 max-w-md mx-auto my-8">
            <div class="text-xs text-amber-400 font-semibold">Could not connect to the server</div>
            <div class="text-[11px] text-zinc-400">Check that the backend is running at <code>http://localhost:4115</code></div>
            <button onclick="switchThread('${threadId}')" class="mt-2 text-xs px-3 py-1.5 rounded-lg theme-card theme-accent border theme-border font-semibold cursor-pointer">Try Again</button>
          </div>
        `;
      }
    }

    async function createNewThread(agentId) {
      const threadId = `thread-${Date.now()}`;
      const label = AGENT_META[agentId]?.label;
      try {
        const res = await fetch(`${API_BASE}/api/thread/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            title: label ? `New ${label} Session` : "New Session",
            agentId: agentId || undefined,
          })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        activeThreadId = threadId;
        localStorage.setItem('tutor_active_thread', activeThreadId);
        await loadThreadsList();
        switchThread(threadId);
      } catch (err) {
        alert(`Error creating new chat: ${err.message}`);
      }
    }

    function promptDeleteThread(threadId, threadTitle) {
      pendingDeleteTarget = { type: 'thread', threadId, title: threadTitle };
      document.getElementById('delete-modal-title').textContent = "Delete Chat Session";
      document.getElementById('delete-modal-desc').textContent = "Are you sure you want to delete this conversation?";
      document.getElementById('delete-target-label').textContent = `Session: "${threadTitle || threadId}"`;
      document.getElementById('delete-modal-subdesc').textContent = "All message history for this session will be permanently removed from the database.";
      document.getElementById('delete-archive-option-btn').classList.add('hidden');
      document.getElementById('delete-confirm-modal').classList.remove('hidden');
      lucide.createIcons();
    }

    async function deleteThread(threadId) {
      promptDeleteThread(threadId, threadId);
    }

    // 8. Bulletproof SSE Chat Streaming
    async function handleChatSubmit(e) {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      input.style.height = 'auto';

      if (text === '/compact') {
        await triggerManualCompact();
        return;
      }

      await sendChatMessage(text);
    }

    function appendSystemNoticeCard(innerHtml) {
      const messagesContainer = document.getElementById('messages-container');
      const card = document.createElement('div');
      card.className = "flex justify-center";
      card.innerHTML = `<div class="notice-body theme-card border theme-border rounded-xl px-3.5 py-2 text-[11px] font-mono flex items-center gap-2" style="color: var(--text-muted);">${innerHtml}</div>`;
      messagesContainer.appendChild(card);
      scrollToBottom();
      return card.querySelector('.notice-body');
    }

    // Real transparency: shows the actual summary (expandable), not just "it was compacted".
    function appendCompactSummaryCard(count, summaryText) {
      const messagesContainer = document.getElementById('messages-container');
      const card = document.createElement('div');
      card.className = "flex justify-center";
      card.innerHTML = `
        <details class="theme-card border theme-border rounded-2xl px-3.5 py-2.5 text-[11px] max-w-2xl w-full shadow-sm" style="color: var(--text-muted);">
          <summary class="cursor-pointer select-none flex items-center gap-2 font-mono list-none">
            <i data-lucide="package-check" class="w-3.5 h-3.5 theme-accent shrink-0"></i>
            <span>Conversation compacted — ${count} old messages summarized <span class="opacity-60">(click to see the summary)</span></span>
          </summary>
          <div class="mt-2 pt-2 border-t theme-border prose-chat text-xs" style="color: var(--text-main);">
            ${renderMarkdown(summaryText && summaryText.trim() ? summaryText : "*(resumo vazio)*")}
          </div>
        </details>
      `;
      messagesContainer.appendChild(card);
      scrollToBottom();
      lucide.createIcons();
      return card;
    }

    async function triggerManualCompact() {
      const notice = appendSystemNoticeCard(`<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Compactando conversa...</span>`);
      lucide.createIcons();
      try {
        const res = await fetch(`${API_BASE}/api/thread/compact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId: activeThreadId })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);

        if (data.skipped) {
          notice.innerHTML = `<i data-lucide="info" class="w-3.5 h-3.5"></i><span>Conversa ainda curta — nada pra compactar.</span>`;
          lucide.createIcons();
          return;
        }

        notice.closest('.flex').remove();
        appendCompactSummaryCard(data.summarizedCount, data.summaryText);
      } catch (err) {
        notice.classList.add('text-red-300');
        notice.innerHTML = `<i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i><span>Error compacting: ${escapeHtml(err.message)}</span>`;
        lucide.createIcons();
      }
    }

    // Helper: builds the HTML for a user bubble with an edit button (hover, ChatGPT-style)
    function buildUserMessageHTML(text) {
      return `
        <div class="relative max-w-2xl">
          <div class="user-bubble px-4 py-3 rounded-2xl rounded-tr-none text-base shadow-sm font-sans leading-relaxed">${escapeHtml(text)}</div>
          <div class="flex justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" onclick="startEditMessage(this)" class="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 cursor-pointer" title="Edit and resend">
              <i data-lucide="pencil" class="w-3 h-3 pointer-events-none"></i>
              <span>Edit</span>
            </button>
          </div>
        </div>
      `;
    }

    function buildUserMessageBlock(msgId, text) {
      const userBlock = document.createElement('div');
      userBlock.className = "flex justify-end group";
      if (msgId) userBlock.dataset.msgId = msgId;
      userBlock.innerHTML = buildUserMessageHTML(text);
      return userBlock;
    }

    const editOriginalText = {};

    function startEditMessage(btnEl) {
      if (currentAbortController) return; // don't edit while a response is being generated
      const wrapper = btnEl.closest('[data-msg-id]');
      if (!wrapper) return;
      const msgId = wrapper.dataset.msgId;
      const bubble = wrapper.querySelector('.user-bubble');
      const originalText = bubble ? bubble.textContent : '';
      editOriginalText[msgId] = originalText;

      wrapper.innerHTML = `
        <div class="w-full max-w-2xl space-y-2">
          <textarea id="edit-ta-${msgId}" onkeydown="handleEditKeydown(event, '${msgId}')" class="w-full theme-input border theme-border rounded-2xl p-3 text-base font-sans leading-relaxed resize-none focus:outline-none focus:border-[var(--accent)]" rows="3"></textarea>
          <div class="flex items-center justify-end gap-2">
            <button type="button" onclick="cancelEditMessage('${msgId}')" class="px-3 py-1.5 text-xs rounded-lg theme-card border theme-border hover:border-zinc-500 cursor-pointer">Cancel</button>
            <button type="button" onclick="submitEditMessage('${msgId}')" class="px-3 py-1.5 text-xs rounded-lg btn-primary font-semibold cursor-pointer">Save &amp; Resend</button>
          </div>
        </div>
      `;
      const ta = document.getElementById(`edit-ta-${msgId}`);
      ta.value = originalText;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }

    function handleEditKeydown(e, msgId) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditMessage(msgId);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitEditMessage(msgId);
      }
    }

    function cancelEditMessage(msgId) {
      const wrapper = document.querySelector(`[data-msg-id="${msgId}"]`);
      if (!wrapper) return;
      wrapper.innerHTML = buildUserMessageHTML(editOriginalText[msgId] || '');
      lucide.createIcons();
    }

    async function submitEditMessage(msgId) {
      const ta = document.getElementById(`edit-ta-${msgId}`);
      const newText = ta ? ta.value.trim() : '';
      if (!newText) return;

      const wrapper = document.querySelector(`[data-msg-id="${msgId}"]`);
      if (!wrapper) return;

      try {
        const res = await fetch(`${API_BASE}/api/thread/truncate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId: activeThreadId, fromMessageId: msgId })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        alert(`Error truncating history for editing: ${err.message}`);
        return;
      }

      // Remove this message and everything after it (same rule as the backend)
      let node = wrapper;
      while (node) {
        const next = node.nextElementSibling;
        node.remove();
        node = next;
      }
      delete editOriginalText[msgId];

      await sendChatMessage(newText);
    }

    async function sendChatMessage(text) {
      const messagesContainer = document.getElementById('messages-container');
      const activeAgentId = document.getElementById('agent-selector').value;

      // User Message Block (msgId still unknown — filled in when "done" returns)
      const userBlock = buildUserMessageBlock('', text);
      messagesContainer.appendChild(userBlock);
      scrollToBottom();

      // Show Stop button, hide Send button
      document.getElementById('send-btn').classList.add('hidden');
      document.getElementById('stop-btn').classList.remove('hidden');

      // Assistant Message Block
      const assistantBlock = document.createElement('div');
      assistantBlock.className = "flex items-start gap-3.5";
      const bubbleId = `msg-${Date.now()}`;
      const thoughtsId = `thoughts-${Date.now()}`;
      const stepsId = `steps-${Date.now()}`;

      assistantBlock.innerHTML = `
        <div class="w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5" style="background-color: var(--accent); color: var(--accent-text); box-shadow: 0 2px 8px var(--accent-subtle);">
          ✦
        </div>
        <div class="flex-1 space-y-2 max-w-2xl">
          <div class="font-semibold text-sm text-zinc-200 flex items-center gap-2">
            <span>${activeAgentId.toUpperCase()}</span>
            <span class="text-xs text-zinc-500 font-normal">deepseek-v4-flash</span>
          </div>

          <!-- Mastra UI Live Agent Tracing Steps -->
          <div id="${stepsId}" class="space-y-1.5"></div>

          <!-- Collapsible Thinking Process -->
          <div id="${thoughtsId}" class="hidden"></div>

          <!-- Main Streaming Response Body -->
          <div id="${bubbleId}" class="text-base text-zinc-200 leading-relaxed prose-chat">
            <span class="theme-accent text-xs font-mono flex items-center gap-2 animate-pulse">
              <i data-lucide="sparkles" class="w-3.5 h-3.5 animate-spin theme-accent"></i>
              <span>Agent starting reasoning and step execution...</span>
            </span>
          </div>

          <!-- Message Actions Toolbar (Copy) -->
          <div class="flex items-center gap-3 pt-2 text-xs text-zinc-500">
            <button onclick="copyMessageText('${bubbleId}', this)" class="hover:text-zinc-300 flex items-center gap-1 cursor-pointer">
              <i data-lucide="copy" class="w-3.5 h-3.5 pointer-events-none"></i>
              <span>Copy</span>
            </button>
          </div>
        </div>
      `;
      messagesContainer.appendChild(assistantBlock);
      lucide.createIcons();

      const contentBox = document.getElementById(bubbleId);
      const thoughtsBox = document.getElementById(thoughtsId);
      const stepsBox = document.getElementById(stepsId);

      let accumulatedText = "";
      let accumulatedThought = "";
      let wasStopped = false;
      currentAbortController = new AbortController();
      const pendingToolSteps = new Map();

      try {
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            agentId: activeAgentId,
            threadId: activeThreadId,
          }),
          signal: currentAbortController.signal
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const jsonStr = trimmed.slice(6);
              try {
                const data = JSON.parse(jsonStr);

                // 1. Live Text Token Stream
                if (data.type === "text" && data.text) {
                  accumulatedText += data.text;

                  let renderText = accumulatedText;
                  const thinkMatch = renderText.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
                  if (thinkMatch) {
                    renderThought(thinkMatch[1], thoughtsBox);
                    renderText = renderText.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
                  }

                  contentBox.innerHTML = renderMarkdown(renderText) + '<span class="inline-block w-1.5 h-4 theme-bg-accent animate-pulse ml-0.5 align-middle"></span>';
                  autoScroll();
                }

                // 2. Live Thought / Reasoning Stream
                else if (data.type === "thought" && data.text) {
                  accumulatedThought += data.text;
                  renderThought(accumulatedThought, thoughtsBox);
                  autoScroll();
                }

                // 3. Combined Tool Execution Step (Invocation)
                else if (data.type === "tool-call") {
                  const toolName = data.toolName || "tool";
                  const toolCallId = data.toolCallId || `tc-${Date.now()}`;
                  const skillId = data.skillId || null;
                  const info = getAgentDelegationInfo(toolName, skillId);
                  updateConductorBadge(info.headerText, true);

                  const stepDiv = document.createElement('div');
                  stepDiv.className = "p-3 rounded-2xl theme-card border theme-border text-xs transition-all shadow-md my-2 space-y-2";
                  stepDiv.innerHTML = `
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2 font-bold min-w-0">
                        <span class="text-xs inline-flex items-center justify-center shrink-0 select-none">${info.iconEmoji}</span>
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="text-xs theme-accent">${info.isDelegation ? 'A2A Delegation:' : 'Tool:'} <b>${escapeHtml(info.agentName)}</b></span>
                          <span class="text-[10px] font-normal hidden sm:inline" style="color: var(--text-muted);">(${escapeHtml(info.role)})</span>
                        </div>
                      </div>
                      <span class="text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 font-mono shrink-0 animate-pulse" style="background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);">
                        <i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i>
                        <span>Running...</span>
                      </span>
                    </div>
                    ${data.args && Object.keys(data.args).length > 0 ? `
                      <details class="text-[10px] font-code pt-1 border-t theme-border" style="color: var(--text-muted);">
                        <summary class="cursor-pointer hover:text-[var(--text-main)] select-none">View input parameters (${escapeHtml(toolName)})</summary>
                        <pre class="mt-1 p-2 rounded overflow-x-auto border font-code text-xs" style="background-color: var(--code-bg); border-color: var(--code-border); color: var(--text-muted);">${escapeHtml(JSON.stringify(data.args, null, 2))}</pre>
                      </details>
                    ` : ''}
                  `;
                  stepsBox.appendChild(stepDiv);
                  pendingToolSteps.set(toolCallId, { stepDiv, toolName, skillId, args: data.args, info });
                  pendingToolSteps.set(toolName, { stepDiv, toolName, skillId, args: data.args, info });
                  lucide.createIcons();
                  autoScroll();
                }

                // 4. Combined Tool Execution Step (Result)
                else if (data.type === "tool-result") {
                  const toolName = data.toolName || "tool";
                  const toolCallId = data.toolCallId;
                  const pending = (toolCallId && pendingToolSteps.get(toolCallId)) || pendingToolSteps.get(toolName);
                  const targetDiv = pending ? pending.stepDiv : document.createElement('div');
                  const args = (pending && pending.args) ? pending.args : {};
                  const info = (pending && pending.info) || getAgentDelegationInfo(toolName, pending && pending.skillId);
                  const isError = Boolean(data.isError);
                  updateConductorBadge(currentIdleConductorLabel(), false);

                  targetDiv.className = "my-2";
                  targetDiv.innerHTML = `
                    <div class="p-3 rounded-2xl theme-card border ${isError ? 'border-red-500/50 bg-red-950/30 text-red-300' : 'theme-border'} text-xs transition-all shadow-md space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 font-bold min-w-0">
                          <span class="text-xs inline-flex items-center justify-center shrink-0 select-none">${isError ? '⚠️' : info.iconEmoji}</span>
                          <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-xs ${isError ? 'text-red-300' : 'theme-accent'}">${info.isDelegation ? 'A2A:' : 'Executed:'} <b>${escapeHtml(info.agentName)}</b></span>
                            <span class="text-[10px] font-normal hidden sm:inline" style="color: var(--text-muted);">(${escapeHtml(info.role)})</span>
                          </div>
                        </div>
                        <span class="text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 font-mono shrink-0" style="${isError ? 'color: #f87171; background-color: rgba(239, 68, 68, 0.15); border-color: #ef4444;' : 'background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);'}">
                          <i data-lucide="${isError ? 'alert-triangle' : 'check'}" class="w-3 h-3"></i>
                          <span>${isError ? 'Failed' : 'Completed'}</span>
                        </span>
                      </div>

                      <details class="text-[10px] font-code pt-1 border-t theme-border">
                        <summary class="cursor-pointer hover:text-[var(--text-main)] select-none flex items-center justify-between" style="color: var(--text-muted);">
                          <span>Inspect output &amp; payload for <b>${escapeHtml(toolName)}</b></span>
                          <span class="text-[9px] font-mono" style="color: var(--text-dim);">[expand]</span>
                        </summary>
                        <div class="mt-2 space-y-2">
                          ${args && Object.keys(args).length > 0 ? `
                            <div>
                              <span class="font-sans font-bold" style="color: var(--text-dim);">Input:</span>
                              <pre class="mt-0.5 p-2 rounded overflow-x-auto border font-code text-xs" style="background-color: var(--code-bg); border-color: var(--code-border); color: var(--text-muted);">${escapeHtml(JSON.stringify(args, null, 2))}</pre>
                            </div>
                          ` : ''}
                          <div>
                            <span class="font-sans font-bold" style="color: var(--text-dim);">Output:</span>
                            <pre class="mt-0.5 p-2 rounded overflow-x-auto border font-code text-xs" style="background-color: var(--code-bg); border-color: var(--code-border); color: ${isError ? '#fca5a5' : 'var(--text-main)'};">${escapeHtml(typeof data.result === 'object' ? JSON.stringify(data.result, null, 2) : String(data.result))}</pre>
                          </div>
                        </div>
                      </details>
                    </div>
                  `;

                  if (!pending) {
                    stepsBox.appendChild(targetDiv);
                  }
                  if (toolCallId) pendingToolSteps.delete(toolCallId);
                  pendingToolSteps.delete(toolName);
                  lucide.createIcons();
                  autoScroll();
                }

                // 4.1 Tool Error Step
                else if (data.type === "tool-error") {
                  const toolName = data.toolName || "tool";
                  const toolCallId = data.toolCallId;
                  const pending = (toolCallId && pendingToolSteps.get(toolCallId)) || pendingToolSteps.get(toolName);
                  const targetDiv = pending ? pending.stepDiv : document.createElement('div');
                  const args = (pending && pending.args) ? pending.args : {};
                  const info = (pending && pending.info) || getAgentDelegationInfo(toolName, pending && pending.skillId);
                  updateConductorBadge(currentIdleConductorLabel(), false);

                  targetDiv.className = "my-2";
                  targetDiv.innerHTML = `
                    <div class="p-3 rounded-2xl theme-card border border-red-500/50 bg-red-950/30 text-red-300 text-xs transition-all shadow-md space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 font-bold">
                          <span class="text-xs inline-flex items-center justify-center shrink-0 select-none">⚠️</span>
                          <span class="text-xs text-red-300">Falha em: <b>${escapeHtml(info.agentName)}</b></span>
                        </div>
                        <span class="text-[10px] text-red-400 bg-red-950/80 px-2 py-0.5 rounded-full border border-red-700/80 font-mono">Erro ✗</span>
                      </div>
                      <div class="text-[11px] text-red-200 font-sans leading-snug">${escapeHtml(String(data.error))}</div>
                    </div>
                  `;

                  if (!pending) {
                    stepsBox.appendChild(targetDiv);
                  }
                  if (toolCallId) pendingToolSteps.delete(toolCallId);
                  pendingToolSteps.delete(toolName);
                  lucide.createIcons();
                  autoScroll();
                }

                // 4.2 Tool Suspended / Gate Step
                else if (data.type === "tool-call-suspended") {
                  const toolName = data.toolName || "tool";
                  const toolCallId = data.toolCallId;
                  const pending = (toolCallId && pendingToolSteps.get(toolCallId)) || pendingToolSteps.get(toolName);
                  const targetDiv = pending ? pending.stepDiv : document.createElement('div');

                  targetDiv.className = "my-1";
                  targetDiv.innerHTML = `
                    <div class="p-2.5 rounded-xl theme-card border border-[var(--accent)] text-xs font-mono theme-accent shadow-sm">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <i data-lucide="shield-alert" class="w-3.5 h-3.5 theme-accent"></i>
                          <span><b>${escapeHtml(toolName)}()</b> — Gate / Approval Required</span>
                        </div>
                        <span class="text-[10px] px-2 py-0.5 rounded border" style="background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);">Paused</span>
                      </div>
                    </div>
                  `;
                  if (!pending) {
                    stepsBox.appendChild(targetDiv);
                  }
                  if (toolCallId) pendingToolSteps.delete(toolCallId);
                  pendingToolSteps.delete(toolName);
                  lucide.createIcons();
                  autoScroll();
                }

                // 5. Done Event (Finalize Text & Clean any dangling steps)
                else if (data.type === "done") {
                  if (data.userMessageId) userBlock.dataset.msgId = data.userMessageId;
                  if (data.stopped) wasStopped = true;
                  if (data.compacted) {
                    appendCompactSummaryCard(data.compactedCount, data.compactedSummary);
                  }

                  let renderText = accumulatedText;
                  const thinkMatch = renderText.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
                  if (thinkMatch) {
                    renderThought(thinkMatch[1], thoughtsBox);
                    renderText = renderText.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
                  }
                  contentBox.innerHTML = renderMarkdown(renderText) + (wasStopped ? '<div class="text-[10px] text-zinc-500 mt-1.5 flex items-center gap-1"><i data-lucide="square" class="w-2.5 h-2.5"></i><span>Interrupted by user</span></div>' : '');

                  // Auto-resolve any remaining spinning steps
                  for (const [k, p] of pendingToolSteps.entries()) {
                    if (p && p.stepDiv) {
                      p.stepDiv.className = "my-1";
                      p.stepDiv.innerHTML = wasStopped ? `
                        <div class="theme-card border theme-border rounded-xl p-2.5 text-xs font-mono flex items-center justify-between text-zinc-500">
                          <div class="flex items-center gap-2">
                            <i data-lucide="square" class="w-3.5 h-3.5"></i>
                            <span>${escapeHtml(p.toolName)}()</span>
                          </div>
                          <span class="text-[10px] px-2 py-0.5 rounded border border-zinc-600">Interrupted</span>
                        </div>
                      ` : `
                        <div class="theme-card border theme-border rounded-xl p-2.5 text-xs font-mono flex items-center justify-between theme-accent">
                          <div class="flex items-center gap-2">
                            <i data-lucide="check-circle" class="w-3.5 h-3.5 theme-accent"></i>
                            <span>${escapeHtml(p.toolName)}()</span>
                          </div>
                          <span class="text-[10px] px-2 py-0.5 rounded border" style="background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);">Completed ✓</span>
                        </div>
                      `;
                    }
                  }
                  pendingToolSteps.clear();
                  lucide.createIcons();
                }

                // 6. Error Event
                else if (data.type === "error") {
                  contentBox.innerHTML = `<span class="text-red-400 text-sm">Error: ${escapeHtml(data.error)}</span>`;
                  pendingToolSteps.clear();
                }

              } catch (parseErr) {
                buffer = line + "\n" + buffer;
              }
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          contentBox.innerHTML = `<span class="text-red-400 text-sm">Error connecting to the backend: ${err.message}</span>`;
        } else {
          wasStopped = true;
          // Closes out the accumulated text up to the Stop, instead of leaving the cursor blinking forever.
          let renderText = accumulatedText;
          const thinkMatch = renderText.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
          if (thinkMatch) {
            renderThought(thinkMatch[1], thoughtsBox);
            renderText = renderText.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
          }
          contentBox.innerHTML = renderMarkdown(renderText) + '<div class="text-[10px] text-zinc-500 mt-1.5 flex items-center gap-1"><i data-lucide="square" class="w-2.5 h-2.5"></i><span>Interrupted by user</span></div>';
        }
      } finally {
        // Guarantee all pending tools are cleared and no spinner is left
        for (const [k, p] of pendingToolSteps.entries()) {
          if (p && p.stepDiv) {
            p.stepDiv.className = "my-1";
            p.stepDiv.innerHTML = wasStopped ? `
              <div class="theme-card border theme-border rounded-xl p-2.5 text-xs font-mono flex items-center justify-between text-zinc-500">
                <div class="flex items-center gap-2">
                  <i data-lucide="square" class="w-3.5 h-3.5"></i>
                  <span>${escapeHtml(p.toolName)}()</span>
                </div>
                <span class="text-[10px] px-2 py-0.5 rounded border border-zinc-600">Interrompido</span>
              </div>
            ` : `
              <div class="theme-card border theme-border rounded-xl p-2.5 text-xs font-mono flex items-center justify-between theme-accent">
                <div class="flex items-center gap-2">
                  <i data-lucide="check-circle" class="w-3.5 h-3.5 theme-accent"></i>
                  <span>${escapeHtml(p.toolName)}()</span>
                </div>
                <span class="text-[10px] px-2 py-0.5 rounded border" style="background-color: var(--accent-subtle); color: var(--accent); border-color: var(--accent);">Completed ✓</span>
              </div>
            `;
          }
        }
        pendingToolSteps.clear();
        updateConductorBadge(currentIdleConductorLabel(), false);

        document.getElementById('send-btn').classList.remove('hidden');
        document.getElementById('stop-btn').classList.remove('opacity-50', 'pointer-events-none');
        document.getElementById('stop-btn').classList.add('hidden');
        currentAbortController = null;
        loadThreadsList();
        // The agent may have called meta_set_now/phase_set/workspace_write during the turn —
        // reload NOW.md + the file tree so the sidebar doesn't go stale.
        loadWorkspaceData();
        autoScroll();
        lucide.createIcons();
      }
    }

    function stopGeneration() {
      if (currentAbortController) {
        const btn = document.getElementById('stop-btn');
        if (btn) btn.classList.add('opacity-50', 'pointer-events-none');
        currentAbortController.abort();
      }
    }

    // Helper: Collapsible Thought
    function renderThought(thoughtText, container) {
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
    function renderMarkdown(text) {
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

    function copyCode(btn, text) {
      navigator.clipboard.writeText(text);
      const orig = btn.innerHTML;
      btn.innerHTML = `<span class="theme-accent font-bold">Copiado!</span>`;
      setTimeout(() => { btn.innerHTML = orig; lucide.createIcons(); }, 2000);
    }

    function copyMessageText(bubbleId, btn) {
      const el = document.getElementById(bubbleId);
      if (el) {
        navigator.clipboard.writeText(el.innerText);
        const orig = btn.innerHTML;
        btn.innerHTML = `<span class="theme-accent font-bold">Copiado!</span>`;
        setTimeout(() => { btn.innerHTML = orig; lucide.createIcons(); }, 2000);
      }
    }

    function escapeJsString(str) {
      return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    }

    function escapeHtml(str) {
      return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // =========================================================================
    // 12. WORKSPACE BROWSER & FILE MANAGEMENT (Active & Archived Projects)
    // =========================================================================
    currentPreviewFile = { slug: null, path: null, content: "", isArchived: false };

    // --- VSCode-style file tree: build + render + collapse state ---
    let collapsedTreeNodes = new Set(JSON.parse(localStorage.getItem('tutor_tree_collapsed') || '[]'));

    function isTreeNodeOpen(key) { return !collapsedTreeNodes.has(key); }

    function onTreeToggle(detailsEl) {
      const key = detailsEl.dataset.treeKey;
      if (detailsEl.open) collapsedTreeNodes.delete(key);
      else collapsedTreeNodes.add(key);
      localStorage.setItem('tutor_tree_collapsed', JSON.stringify([...collapsedTreeNodes]));
    }

    // workspaceList already returns paths recursively (dirs and files mixed, flat).
    // Rebuilds them into a nested tree for VSCode-style rendering.
    function buildFileTree(paths) {
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

    function renderFileTreeNode(node, projectSlug, isArchived, depth) {
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

    function renderProjectFileTree(filesList, projectSlug, isArchived) {
      const tree = buildFileTree(filesList);
      if (tree.children.length === 0) return `<div class="text-[10px] text-zinc-500 p-1">No files</div>`;
      const sortedChildren = [...tree.children].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return sortedChildren.map(c => renderFileTreeNode(c, projectSlug, isArchived, 0)).join('');
    }

    async function loadWorkspaceData() {
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
    async function openWorkspaceFile(slug, filePath, isArchived = false) {
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

        currentPreviewFile = { slug, path: filePath, content: data.content || "", isArchived };
        editor.value = data.content || "";
        editor.focus();
      } catch (err) {
        editor.value = `Erro ao ler arquivo: ${err.message}`;
      }
    }

    // Save edited file
    async function saveCurrentFileContent() {
      const editor = document.getElementById('file-modal-editor');
      const saveStatus = document.getElementById('file-save-status');
      const newContent = editor.value;

      try {
        const res = await fetch(`${API_BASE}/api/workspace/write`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: currentPreviewFile.slug,
            path: currentPreviewFile.path,
            content: newContent,
            isArchived: currentPreviewFile.isArchived
          })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        currentPreviewFile.content = newContent;
        saveStatus.classList.remove('hidden');
        setTimeout(() => saveStatus.classList.add('hidden'), 2500);
        loadWorkspaceData();
      } catch (err) {
        alert(`Erro ao salvar arquivo: ${err.message}`);
      }
    }

    // Safe In-App Delete & Archive Handlers
    pendingDeleteTarget = { type: null, slug: null, path: null, isArchived: false };

    function promptDeleteFile(slug, filePath, isArchived = false) {
      pendingDeleteTarget = { type: 'file', slug, path: filePath, isArchived };
      document.getElementById('delete-modal-title').textContent = "Confirm File Deletion";
      document.getElementById('delete-modal-desc').textContent = "Are you sure you want to permanently delete the file:";
      document.getElementById('delete-target-label').textContent = `${slug ? slug + ' / ' : ''}${filePath}`;
      document.getElementById('delete-modal-subdesc').textContent = "This action is irreversible.";
      document.getElementById('delete-archive-option-btn').classList.add('hidden');
      document.getElementById('delete-confirm-modal').classList.remove('hidden');
      lucide.createIcons();
    }

    function promptDeleteProject(slug, isArchived = false) {
      pendingDeleteTarget = { type: 'project', slug, path: null, isArchived };
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

    function promptDeleteArc(arcId, arcTitle) {
      pendingDeleteTarget = { type: 'arc', arcId, title: arcTitle || arcId };
      document.getElementById('delete-modal-title').textContent = "Delete Capability Arc";
      document.getElementById('delete-modal-desc').textContent = "Are you sure you want to permanently delete the following capability arc?";
      document.getElementById('delete-target-label').textContent = `Arc: "${arcTitle || arcId}" (${arcId})`;
      document.getElementById('delete-modal-subdesc').textContent = "All goals, challenges, and evidence linked to this arc will be permanently removed.";
      document.getElementById('delete-archive-option-btn').classList.add('hidden');
      document.getElementById('delete-confirm-modal').classList.remove('hidden');
      lucide.createIcons();
    }

    function deleteCurrentFile() {
      if (!currentPreviewFile.path) return;
      promptDeleteFile(currentPreviewFile.slug, currentPreviewFile.path, currentPreviewFile.isArchived);
    }

    async function promptArchiveProject(slug) {
      if (!confirm(`Mark the project "${slug}" as completed and move it to the completed-archives folder?`)) return;
      await executeArchive(slug, "archive");
    }

    async function restoreProject(slug) {
      await executeArchive(slug, "restore");
    }

    async function executeArchive(slug, action) {
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

    async function executeArchiveFromModal() {
      if (!pendingDeleteTarget.slug) return;
      const slug = pendingDeleteTarget.slug;
      closeDeleteConfirmModal();
      await executeArchive(slug, "archive");
    }

    async function executePendingDelete() {
      const btn = document.getElementById('delete-confirm-action-btn');
      btn.disabled = true;
      btn.textContent = "Excluindo...";

      try {
        if (pendingDeleteTarget.type === 'thread') {
          const threadId = pendingDeleteTarget.threadId;
          const res = await fetch(`${API_BASE}/api/thread/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ threadId })
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          if (activeThreadId === threadId) {
            activeThreadId = 'session-principal';
            localStorage.setItem('tutor_active_thread', activeThreadId);
          }
          closeDeleteConfirmModal();
          await loadThreadsList();
          switchThread(activeThreadId);
          return;
        }

        if (pendingDeleteTarget.type === 'arc') {
          const arcId = pendingDeleteTarget.arcId;
          const res = await fetch(`${API_BASE}/api/arc/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ arcId })
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          closeDeleteConfirmModal();
          await loadArcsData();
          return;
        }

        if (pendingDeleteTarget.type === 'evidence') {
          const id = pendingDeleteTarget.id;
          const res = await fetch(`${API_BASE}/api/memory/evidence/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          closeDeleteConfirmModal();
          await loadMemoryData();
          return;
        }

        if (pendingDeleteTarget.type === 'observation') {
          const index = pendingDeleteTarget.index;
          const res = await fetch(`${API_BASE}/api/memory/observation/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index })
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          closeDeleteConfirmModal();
          await loadMemoryData();
          return;
        }

        if (pendingDeleteTarget.type === 'episode') {
          const { index, date, projectSlug, topic } = pendingDeleteTarget;
          const res = await fetch(`${API_BASE}/api/memory/episode/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index, date, projectSlug, topic })
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          closeDeleteConfirmModal();
          await loadMemoryData();
          return;
        }

        if (pendingDeleteTarget.type === 'episodes-clear') {
          const res = await fetch(`${API_BASE}/api/memory/episodes/clear`, {
            method: "POST"
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          closeDeleteConfirmModal();
          await loadMemoryData();
          return;
        }

        if (pendingDeleteTarget.type === 'experiment') {
          const id = pendingDeleteTarget.id;
          const res = await fetch(`${API_BASE}/api/experiments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete", id })
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          closeDeleteConfirmModal();
          await loadMemoryData();
          return;
        }

        const res = await fetch(`${API_BASE}/api/workspace/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: pendingDeleteTarget.slug || undefined,
            path: pendingDeleteTarget.path || undefined,
            isArchived: pendingDeleteTarget.isArchived
          })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        closeDeleteConfirmModal();
        closeFileModal();
        loadWorkspaceData();
      } catch (err) {
        alert(`Erro ao excluir: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i><span>Excluir</span>`;
        lucide.createIcons();
      }
    }

    function closeDeleteConfirmModal() {
      document.getElementById('delete-confirm-modal').classList.add('hidden');
      pendingDeleteTarget = { type: null, slug: null, path: null, isArchived: false };
    }

    // In-App New File Handlers
    function openNewFileModalForProject(slug) {
      document.getElementById('new-file-slug').value = slug;
      document.getElementById('new-file-name').value = '';
      document.getElementById('new-file-modal').classList.remove('hidden');
      document.getElementById('new-file-name').focus();
    }

    function closeNewFileModal() {
      document.getElementById('new-file-modal').classList.add('hidden');
    }

    async function handleCreateFileSubmit(e) {
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
    function openNewProjectModal() { document.getElementById('new-project-modal').classList.remove('hidden'); }
    function closeNewProjectModal() { document.getElementById('new-project-modal').classList.add('hidden'); }

    async function handleCreateProjectSubmit(e) {
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

    function injectCurrentFileInChat() {
      if (currentPreviewFile.content) {
        closeFileModal();
        quickPrompt(`[FILE: ${currentPreviewFile.slug || 'ROOT'}/${currentPreviewFile.path}]\n\`\`\`markdown\n${currentPreviewFile.content}\n\`\`\`\n\nAnalyze the state and implementation above.`);
      }
    }

    function closeFileModal() { document.getElementById('file-modal').classList.add('hidden'); }

    // =========================================================================
    // 14. DYNAMIC CAPABILITY ARCS & JUDGMENT ENGINE
    // =========================================================================
    let cachedArcs = [];

    async function loadArcsData() {
      const container = document.getElementById('arcs-tracks-container') || document.getElementById('curriculum-tracks-container');
      const progressPct = document.getElementById('arcs-progress-pct') || document.getElementById('curriculum-progress-pct');
      const progressBar = document.getElementById('arcs-progress-bar') || document.getElementById('curriculum-progress-bar');

      try {
        const res = await fetch(`${API_BASE}/api/arcs`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        cachedArcs = data.arcs || [];

        let totalCaps = 0;
        let doneCaps = 0;
        cachedArcs.forEach(a => {
          (a.capabilities || []).forEach(c => {
            totalCaps++;
            if (c.verified) doneCaps++;
          });
        });

        const pct = totalCaps > 0 ? Math.round((doneCaps / totalCaps) * 100) : 0;
        if (progressPct) progressPct.textContent = `${pct}% (${doneCaps}/${totalCaps})`;
        if (progressBar) progressBar.style.width = `${pct}%`;

        if (cachedArcs.length === 0) {
          if (container) {
            container.innerHTML = `
              <div class="p-4 text-center space-y-2">
                <div class="text-xs text-zinc-400">Nenhum arco de capacidade configurado.</div>
                <button onclick="openNewArcModal()" class="px-3 py-1.5 rounded-lg btn-primary text-xs font-bold shadow-sm">
                  + Criar Meu Primeiro Arco
                </button>
              </div>
            `;
          }
          return;
        }

        renderArcsList();
      } catch (err) {
        if (container) container.innerHTML = `<div class="p-3 text-red-400 text-xs">Erro ao carregar arcos: ${err.message}</div>`;
      }
    }

    function renderArcsList() {
      const container = document.getElementById('arcs-tracks-container') || document.getElementById('curriculum-tracks-container');
      if (!container) return;

      container.innerHTML = cachedArcs.map((arc) => {
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
                <button onclick="openEditArcModal('${escapeHtml(arc.id)}')" class="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer app-no-drag" data-tauri-drag-region="false" title="Editar Arco">
                  <i data-lucide="edit-3" class="w-3.5 h-3.5 pointer-events-none"></i>
                </button>
                <button onclick="promptDeleteArc('${escapeHtml(arc.id)}', '${escapeHtml(arc.title || arc.id)}')" class="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400 cursor-pointer app-no-drag" data-tauri-drag-region="false" title="Excluir Arco">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
                </button>
                <button onclick="promptAddCapability('${escapeHtml(arc.id)}')" class="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer app-no-drag" data-tauri-drag-region="false" title="Adicionar Meta de Julgamento">
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
                        <button onclick="toggleArcCapabilityVerified('${escapeHtml(arc.id)}', '${escapeHtml(cap.id)}', ${isDone})" title="${isDone ? 'Meta Verificada' : 'Marcar como Verificada'}" class="shrink-0 cursor-pointer app-no-drag" data-tauri-drag-region="false">
                          <i data-lucide="${isDone ? 'check-circle-2' : 'circle'}" class="w-3.5 h-3.5 pointer-events-none ${isDone ? 'text-emerald-400 fill-emerald-500/20' : 'text-zinc-500 group-hover:text-zinc-400'}"></i>
                        </button>
                        <span class="text-xs text-zinc-200 font-medium leading-tight ${isDone ? 'text-emerald-300' : ''}">${escapeHtml(cap.title)}</span>
                      </div>

                      <div class="flex items-center gap-1 shrink-0">
                        <button onclick="generateAssignmentForCapability('${escapeHtml(arc.id)}', '${escapeHtml(cap.id)}', '${escapeHtml(cap.title)}')" title="Gerar Desafio de Engenharia (Assigner)" class="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm cursor-pointer app-no-drag" data-tauri-drag-region="false">
                          <i data-lucide="zap" class="w-3 h-3 pointer-events-none"></i>
                          <span>Desafio</span>
                        </button>
                        <button onclick="removeCapability('${escapeHtml(arc.id)}', '${escapeHtml(cap.id)}')" class="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-red-400 transition-opacity cursor-pointer app-no-drag" data-tauri-drag-region="false" title="Remover Meta">
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

    async function toggleArcCapabilityVerified(arcId, capId, currentState) {
      if (currentState) {
        const arc = cachedArcs.find(a => a.id === arcId);
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

    async function promptAddCapability(arcId) {
      const title = prompt("Enter the title of the new capability goal / technical judgment:");
      if (!title || !title.trim()) return;

      const arc = cachedArcs.find(a => a.id === arcId);
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

    async function removeCapability(arcId, capId) {
      const arc = cachedArcs.find(a => a.id === arcId);
      if (!arc) return;
      arc.capabilities = (arc.capabilities || []).filter(c => c.id !== capId);
      await saveAllArcs();
    }

    async function deleteArc(arcId) {
      const arc = cachedArcs.find(a => a.id === arcId);
      promptDeleteArc(arcId, arc ? arc.title : arcId);
    }

    function openEditArcModal(arcId) {
      const arc = cachedArcs.find(a => a.id === arcId);
      if (!arc) return;

      document.getElementById('new-arc-id').value = arc.id;
      document.getElementById('new-arc-id').readOnly = true;
      document.getElementById('new-arc-title').value = arc.title || '';
      document.getElementById('new-arc-desc').value = arc.description || '';
      document.getElementById('new-arc-color').value = arc.color || 'emerald';
      document.getElementById('new-arc-caps').value = (arc.capabilities || []).map(c => c.title).join('\n');
      document.getElementById('arc-modal-heading').textContent = `Editar Arco: ${arc.id}`;

      document.getElementById('arc-custom-modal').classList.remove('hidden');
    }

    async function saveAllArcs() {
      try {
        const res = await fetch(`${API_BASE}/api/arcs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ arcs: cachedArcs })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        loadArcsData();
      } catch (err) {
        alert(`Erro ao salvar arcos: ${err.message}`);
      }
    }

    function generateAssignmentForCapability(arcId, capId, capTitle) {
      setSidebarTab('chat');
      quickPrompt(`[ASSIGNMENT REQUEST]\nArco: ${arcId}\nMeta: ${capTitle}\n\nGere um desafio de engenharia estruturado no protocolo Predict ➔ Measure ➔ Mutate ➔ Explain para exercitar e expor essa lacuna de julgamento.`);
    }

    function openNewArcModal() {
      document.getElementById('new-arc-id').value = '';
      document.getElementById('new-arc-id').readOnly = false;
      document.getElementById('new-arc-title').value = '';
      document.getElementById('new-arc-desc').value = '';
      document.getElementById('new-arc-color').value = 'emerald';
      document.getElementById('new-arc-caps').value = '';
      document.getElementById('arc-modal-heading').textContent = 'Criar Novo Arco de Capacidade';
      document.getElementById('arc-custom-modal').classList.remove('hidden');
    }
    function closeNewArcModal() {
      document.getElementById('arc-custom-modal').classList.add('hidden');
    }

    async function handleCreateArcSubmit(e) {
      e.preventDefault();
      const id = document.getElementById('new-arc-id').value.trim();
      const title = document.getElementById('new-arc-title').value.trim();
      const description = document.getElementById('new-arc-desc').value.trim();
      const color = document.getElementById('new-arc-color').value;
      const rawCaps = document.getElementById('new-arc-caps').value.trim();

      const existing = cachedArcs.find(a => a.id === id);
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
        alert(`Erro ao salvar arco: ${err.message}`);
      }
    }


    // =========================================================================
    // 15. CURRICULUM ROADMAP & PROJECT STARTER ENGINE (LEGACY ADAPTED)
    async function loadCurriculumData() {
      await loadArcsData();
    }

    // =========================================================================
    // 10. MEMORY, AUDIT GRAPH (L1 -> L2 -> L3) & OBSERVATIONS ENGINE
    // =========================================================================
    let cachedMemoryGraph = null;
    let cachedMemoryData = null;
    let cachedExpData = null;
    let activeMemoryFilter = 'all';

    function setMemoryFilter(filter) {
      activeMemoryFilter = filter;
      renderMemoryContent();
    }

    async function loadMemoryData() {
      const container = document.getElementById('memory-content-area');
      try {
        const [graphRes, memRes, expRes] = await Promise.all([
          fetch(`${API_BASE}/api/memory/graph`).catch(() => null),
          fetch(`${API_BASE}/api/memory`).catch(() => null),
          fetch(`${API_BASE}/api/experiments`).catch(() => null)
        ]);

        cachedMemoryGraph = graphRes && graphRes.ok ? await graphRes.json() : null;
        cachedMemoryData = memRes && memRes.ok ? await memRes.json() : { observations: [], episodes: [], totalNotes: 0, library: [] };
        cachedExpData = expRes && expRes.ok ? await expRes.json() : { experiments: [] };

        renderMemoryContent();
      } catch (err) {
        container.innerHTML = `<div class="p-2 text-red-400 text-xs">Error loading memory: ${err.message}</div>`;
      }
    }

    function renderMemoryContent() {
      const container = document.getElementById('memory-content-area');
      if (!container) return;

      const graph = cachedMemoryGraph || { l3: { arcs: [] }, l2: [], l1: [], stats: { totalL1Traces: 0, totalL2Evidences: 0, verifiedCapabilities: 0, auditHealthScore: 100 } };
      const memData = cachedMemoryData || { observations: [], episodes: [], totalNotes: 0, library: [] };
      const expData = cachedExpData || { experiments: [] };

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
          <button onclick="setMemoryFilter('all')" class="px-2 py-0.5 rounded-lg ${activeMemoryFilter === 'all' ? 'btn-primary font-bold' : 'btn-secondary'} cursor-pointer transition-all">All</button>
          <button onclick="setMemoryFilter('l2')" class="px-2 py-0.5 rounded-lg ${activeMemoryFilter === 'l2' ? 'btn-primary font-bold' : 'btn-secondary'} cursor-pointer transition-all">L2 Facts (${evidences.length})</button>
          <button onclick="setMemoryFilter('l1')" class="px-2 py-0.5 rounded-lg ${activeMemoryFilter === 'l1' ? 'btn-primary font-bold' : 'btn-secondary'} cursor-pointer transition-all">L1 Traces (${l1Traces.length})</button>
          <button onclick="setMemoryFilter('experiments')" class="px-2 py-0.5 rounded-lg ${activeMemoryFilter === 'experiments' ? 'btn-primary font-bold' : 'btn-secondary'} cursor-pointer transition-all">Experiments (${experiments.length})</button>
          <button onclick="setMemoryFilter('obs')" class="px-2 py-0.5 rounded-lg ${activeMemoryFilter === 'obs' ? 'btn-primary font-bold' : 'btn-secondary'} cursor-pointer transition-all">Obs (${observations.length})</button>
        </div>

        <!-- 3. L2 Curated Surface Facts & Evidences -->
        ${(activeMemoryFilter === 'all' || activeMemoryFilter === 'l2') ? `
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
        ${(activeMemoryFilter === 'all' || activeMemoryFilter === 'l1') ? `
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
        ${(activeMemoryFilter === 'all' || activeMemoryFilter === 'experiments') ? `
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
        ${(activeMemoryFilter === 'all' || activeMemoryFilter === 'obs') ? `
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
    let editingEvidenceId = null;

    function promptAddEvidence() {
      editingEvidenceId = null;
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

    function editEvidence(id) {
      const graph = cachedMemoryGraph || {};
      const ev = (graph.l2 || []).find(e => e.id === id);
      if (!ev) return;
      editingEvidenceId = id;
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

    function closeAddEvidenceModal() {
      document.getElementById('add-evidence-modal').classList.add('hidden');
      editingEvidenceId = null;
    }

    async function handleCreateEvidenceSubmit(e) {
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
            id: editingEvidenceId || undefined,
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

    function promptDeleteEvidence(id, claim) {
      pendingDeleteTarget = { type: 'evidence', id };
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
    let editingObsIndex = null;

    function promptAddObservation() {
      editingObsIndex = null;
      document.getElementById('new-obs-tag').value = 'Insight';
      document.getElementById('new-obs-text').value = '';
      document.getElementById('obs-modal-title').textContent = "Add Semantic Observation";
      document.getElementById('obs-modal-submit-btn').textContent = "Save Observation";
      document.getElementById('add-obs-modal').classList.remove('hidden');
      document.getElementById('new-obs-text').focus();
    }

    function editObservation(index) {
      const mem = cachedMemoryData || {};
      const obs = (mem.observations || [])[index];
      if (!obs) return;
      editingObsIndex = index;
      document.getElementById('new-obs-tag').value = obs.tag || 'Insight';
      document.getElementById('new-obs-text').value = obs.text || '';
      document.getElementById('obs-modal-title').textContent = "Edit Semantic Observation";
      document.getElementById('obs-modal-submit-btn').textContent = "Update Observation";
      document.getElementById('add-obs-modal').classList.remove('hidden');
      document.getElementById('new-obs-text').focus();
    }

    function closeAddObsModal() {
      document.getElementById('add-obs-modal').classList.add('hidden');
      editingObsIndex = null;
    }

    async function handleCreateObsSubmit(e) {
      e.preventDefault();
      const tag = document.getElementById('new-obs-tag').value.trim();
      const text = document.getElementById('new-obs-text').value.trim();
      if (!text) return;

      try {
        const isEditing = editingObsIndex !== null;
        const endpoint = isEditing ? `${API_BASE}/api/memory/observation/update` : `${API_BASE}/api/memory/observation/add`;
        const body = isEditing ? { index: editingObsIndex, tag, text } : { tag, text };

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

    function promptDeleteObservation(index, tag, text) {
      pendingDeleteTarget = { type: 'observation', index };
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
    function promptDeleteEpisode(index, date, projectSlug, topic) {
      pendingDeleteTarget = { type: 'episode', index, date, projectSlug, topic };
      document.getElementById('delete-modal-title').textContent = "Delete L1 Episode Record";
      document.getElementById('delete-modal-desc').textContent = "Are you sure you want to delete this session from episodic memory?";
      document.getElementById('delete-target-label').textContent = `${date || 'Today'} - ${projectSlug || 'OS'}: ${(topic || '').slice(0, 60)}`;
      document.getElementById('delete-modal-subdesc').textContent = "The raw trace record will be removed from EPISODES.jsonl.";
      document.getElementById('delete-archive-option-btn').classList.add('hidden');
      document.getElementById('delete-confirm-modal').classList.remove('hidden');
    }

    function promptClearAllEpisodes() {
      pendingDeleteTarget = { type: 'episodes-clear' };
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
    function promptPurgeMemory() {
      document.getElementById('purge-memory-modal').classList.remove('hidden');
    }

    function closePurgeMemoryModal() {
      document.getElementById('purge-memory-modal').classList.add('hidden');
    }

    async function executeMemoryPurge() {
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
    function promptDeleteExperiment(expId, title) {
      pendingDeleteTarget = { type: 'experiment', id: expId };
      document.getElementById('delete-modal-title').textContent = "Delete Experiment";
      document.getElementById('delete-modal-desc').textContent = "Are you sure you want to delete this experiment?";
      document.getElementById('delete-target-label').textContent = `${expId}: ${title || ''}`;
      document.getElementById('delete-modal-subdesc').textContent = "The experiment will be permanently removed from the collection.";
      document.getElementById('delete-archive-option-btn').classList.add('hidden');
      document.getElementById('delete-confirm-modal').classList.remove('hidden');
    }

    async function updateExperimentStatus(expId, newStatus) {
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

    function promptAddExperiment() {
      document.getElementById('new-exp-title').value = '';
      document.getElementById('new-exp-hypothesis').value = '';
      document.getElementById('new-exp-tweak').value = '';
      document.getElementById('add-experiment-modal').classList.remove('hidden');
      document.getElementById('new-exp-title').focus();
    }

    function closeAddExperimentModal() {
      document.getElementById('add-experiment-modal').classList.add('hidden');
    }

    async function handleCreateExperimentSubmit(e) {
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

    // =========================================================================
    // 11. MULTI-SOURCE WEB & ARXIV RESEARCH ENGINE
    // =========================================================================
    let currentResearchMode = 'web';

    function setResearchMode(mode) {
      currentResearchMode = mode;
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

    async function handleSidebarPaperSearch(e) {
      if (e) e.preventDefault();
      const input = document.getElementById('sidebar-arxiv-query');
      const query = input.value.trim();
      if (!query) return;

      const container = document.getElementById('sidebar-papers-results');
      const badge = document.getElementById('sidebar-papers-badge');
      container.innerHTML = `<div class="p-3 text-zinc-400 text-xs animate-pulse flex items-center gap-2">
        <i data-lucide="loader-2" class="w-4 h-4 animate-spin theme-accent"></i>
        <span>Searching ${currentResearchMode === 'web' ? 'the Technical Web' : 'the arXiv archive'} for "${escapeHtml(query)}"...</span>
      </div>`;
      lucide.createIcons();

      try {
        const res = await fetch(`${API_BASE}/api/research`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            mode: currentResearchMode,
            maxResults: currentResearchMode === 'web' ? 8 : 12,
          })
        });
        const data = await res.json();

        // 1. Render Web Search Results
        if (currentResearchMode === 'web') {
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

    function injectPaperPrompt(title) {
      quickPrompt(`Explain how the paper "${title}" applies to the invariants and trade-offs of our implementation.`);
    }

    // =========================================================================
    // DEEPTUTOR PAGEINDEX & SURGICAL CITATION VIEWER
    // =========================================================================
    let currentDissectionData = null;

    async function dissectPaper(url, title, abstract) {
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
        currentDissectionData = data.dissection;
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

    function renderDissectionModal() {
      const d = currentDissectionData;
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

    async function exportDissectionToL2(btn) {
      const d = currentDissectionData;
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

    function closePaperPageIndexModal() {
      document.getElementById('paper-pageindex-modal').classList.add('hidden');
      currentDissectionData = null;
    }

    // 12. Cognitive Rescue Trigger
    async function triggerRescue(scenario) {
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

    function submitRamDump() {
      const text = document.getElementById('ram-dump-input').value.trim();
      if (text) {
        closeRescueModal();
        quickPrompt(`[RAM DUMP]: ${text}`);
      } else {
        closeRescueModal();
      }
    }

    async function loadActiveModelConfig() {
      try {
        const res = await fetch(`${API_BASE}/api/config`);
        const data = await res.json();
        if (!data) return;

        const dropdown = document.getElementById('model-select-dropdown');
        const customInput = document.getElementById('model-custom-input');
        const knownModel = data.model && [...dropdown.options].some(o => o.value === data.model);
        dropdown.value = knownModel ? data.model : 'custom';
        customInput.value = knownModel ? '' : (data.model || '');
        customInput.classList.toggle('hidden', knownModel);

        document.getElementById('config-base-url').value = data.baseURL || '';
        document.getElementById('config-api-key-status').textContent = data.hasApiKey ? '(key set)' : '(no key set)';
      } catch (e) {}
    }

    function onModelSelectChange(value) {
      document.getElementById('model-custom-input').classList.toggle('hidden', value !== 'custom');
    }

    async function saveAiConfig() {
      const dropdown = document.getElementById('model-select-dropdown');
      const model = dropdown.value === 'custom'
        ? document.getElementById('model-custom-input').value.trim()
        : dropdown.value;
      const apiKeyInput = document.getElementById('config-api-key');

      const payload = { model, base_url: document.getElementById('config-base-url').value.trim() };
      if (apiKeyInput.value.trim()) payload.api_key = apiKeyInput.value.trim();

      try {
        const res = await fetch(`${API_BASE}/api/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.ok) throw new Error("save failed");

        apiKeyInput.value = '';
        loadActiveModelConfig();
        const status = document.getElementById('ai-config-status');
        status.classList.remove('hidden');
        setTimeout(() => status.classList.add('hidden'), 3000);
      } catch (err) {
        alert(`Error saving AI connection: ${err.message}`);
      }
    }

    async function loadLearnerProfileConfig() {
      try {
        const res = await fetch(`${API_BASE}/api/config/learner-profile`);
        const data = await res.json();
        if (data && data.profile) {
          document.getElementById('lp-name').value = data.profile.name || '';
          document.getElementById('lp-work-role').value = data.profile.workRole || '';
          document.getElementById('lp-cognitive-tag').value = data.profile.cognitiveTag || '';
          document.getElementById('lp-cognitive-detail').value = data.profile.cognitiveProfileDetail || '';
          document.getElementById('lp-rescue-profile').checked = Boolean(data.profile.hasNeuropsychRescueProfile);
        }
      } catch (e) {}
    }

    async function saveLearnerProfile() {
      const payload = {
        name: document.getElementById('lp-name').value.trim() || 'you',
        workRole: document.getElementById('lp-work-role').value.trim(),
        cognitiveTag: document.getElementById('lp-cognitive-tag').value.trim(),
        cognitiveProfileDetail: document.getElementById('lp-cognitive-detail').value,
        hasNeuropsychRescueProfile: document.getElementById('lp-rescue-profile').checked,
      };
      try {
        const res = await fetch(`${API_BASE}/api/config/learner-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
          const status = document.getElementById('learner-profile-status');
          if (status) {
            status.classList.remove('hidden');
            setTimeout(() => status.classList.add('hidden'), 4000);
          }
        }
      } catch (err) {
        alert(`Erro ao salvar perfil: ${err.message}`);
      }
    }

    function openSettingsModal() {
      document.getElementById('settings-modal').classList.remove('hidden');
      loadActiveModelConfig();
      loadLearnerProfileConfig();
      renderThemeSettingsUI();
      applyFontSize(currentFontSize);
      lucide.createIcons();
    }
    function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }
    function openRescueModal() { document.getElementById('rescue-modal').classList.remove('hidden'); }
    function closeRescueModal() { document.getElementById('rescue-modal').classList.add('hidden'); }

    // 14. Quick Inbox Capture Handlers (Cheat Sheet §7 & §8)
    function openQuickInboxModal() {
      document.getElementById('quick-inbox-modal').classList.remove('hidden');
      document.getElementById('quick-inbox-idea').value = '';
      document.getElementById('quick-inbox-reason').value = '';
      document.getElementById('quick-inbox-next').value = '';
      document.getElementById('quick-inbox-idea').focus();
    }

    function closeQuickInboxModal() {
      document.getElementById('quick-inbox-modal').classList.add('hidden');
    }

    async function handleQuickInboxSubmit(e) {
      e.preventDefault();
      const idea = document.getElementById('quick-inbox-idea').value.trim();
      const reason = document.getElementById('quick-inbox-reason').value.trim();
      const nextStep = document.getElementById('quick-inbox-next').value.trim();
      if (!idea) return;

      const submitBtn = document.getElementById('quick-inbox-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = "Salvando...";

      try {
        const res = await fetch(`${API_BASE}/api/inbox`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idea, reason, nextStep })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        closeQuickInboxModal();
        loadWorkspaceData();
      } catch (err) {
        alert(`Erro ao salvar no Inbox: ${err.message}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i><span>Guardar no Inbox</span>`;
        lucide.createIcons();
      }
    }

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

    // Centralized Event Delegation for Threads List (Click & DblClick)
    const threadsListEl = document.getElementById('threads-list');
    if (threadsListEl) {
      threadsListEl.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('[data-action="delete-thread"]');
        if (deleteBtn) {
          e.preventDefault();
          e.stopPropagation();
          const threadId = deleteBtn.getAttribute('data-thread-id');
          const threadTitle = deleteBtn.getAttribute('data-thread-title') || threadId;
          promptDeleteThread(threadId, threadTitle);
          return;
        }

        const renameBtn = e.target.closest('[data-action="rename-thread"]');
        if (renameBtn) {
          e.preventDefault();
          e.stopPropagation();
          const threadId = renameBtn.getAttribute('data-thread-id');
          const threadTitle = renameBtn.getAttribute('data-thread-title') || '';
          renameThread(threadId, threadTitle);
          return;
        }

        const exportBtn = e.target.closest('[data-action="export-thread"]');
        if (exportBtn) {
          e.preventDefault();
          e.stopPropagation();
          const threadId = exportBtn.getAttribute('data-thread-id');
          if (threadId) {
            window.open(`${API_BASE}/api/thread/export?threadId=${encodeURIComponent(threadId)}`, '_blank');
          }
          return;
        }

        const threadItem = e.target.closest('[data-thread-id]');
        if (threadItem) {
          e.preventDefault();
          e.stopPropagation();
          const threadId = threadItem.getAttribute('data-thread-id');
          if (threadId) {
            switchThread(threadId);
          }
        }
      });

      threadsListEl.addEventListener('dblclick', (e) => {
        const threadItem = e.target.closest('[data-thread-id]');
        if (threadItem && !e.target.closest('[data-action]')) {
          e.preventDefault();
          e.stopPropagation();
          const threadId = threadItem.getAttribute('data-thread-id');
          const threadTitle = threadItem.getAttribute('data-thread-title') || '';
          renameThread(threadId, threadTitle);
        }
      });
    }

    // Initialize Theme (must run after all let/const declarations above so
    // setSkin's downstream call into loadThreadsList doesn't hit its
    // variables in the temporal dead zone)
    loadSavedCustomTheme();
    const savedSkin = localStorage.getItem('tutor_skin') || 'classic';
    setSkin(savedSkin);

    // Auto-load initial data
    loadThreadsList().then(() => switchThread(activeThreadId));
    loadWorkspaceData();
    handleSidebarPaperSearch();
