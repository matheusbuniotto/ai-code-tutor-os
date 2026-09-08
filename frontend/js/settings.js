// =========================================================================
// SETTINGS MODAL: AI CONNECTION CONFIG + LEARNER PROFILE
// =========================================================================

import { API_BASE, State } from './state.js';
import { applyFontSize, renderThemeSettingsUI } from './theme.js';

export async function loadActiveModelConfig() {
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

export function onModelSelectChange(value) {
  document.getElementById('model-custom-input').classList.toggle('hidden', value !== 'custom');
}

export async function saveAiConfig() {
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

export async function loadLearnerProfileConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config/learner-profile`);
    const data = await res.json();
    if (data && data.profile) {
      document.getElementById('lp-name').value = data.profile.name || '';
      document.getElementById('lp-work-role').value = data.profile.workRole || '';
      document.getElementById('lp-domain-label').value = data.profile.domainLabel || '';
      document.getElementById('lp-career-horizon').value = data.profile.careerHorizon || '';
      document.getElementById('lp-cognitive-tag').value = data.profile.cognitiveTag || '';
      document.getElementById('lp-cognitive-detail').value = data.profile.cognitiveProfileDetail || '';
      document.getElementById('lp-rescue-profile').checked = Boolean(data.profile.hasNeuropsychRescueProfile);
    }
  } catch (e) {}
}

export async function saveLearnerProfile() {
  const payload = {
    name: document.getElementById('lp-name').value.trim() || 'you',
    workRole: document.getElementById('lp-work-role').value.trim(),
    domainLabel: document.getElementById('lp-domain-label').value.trim(),
    careerHorizon: document.getElementById('lp-career-horizon').value.trim(),
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
    alert(`Error saving profile: ${err.message}`);
  }
}

export function openSettingsModal() {
  document.getElementById('settings-modal').classList.remove('hidden');
  loadActiveModelConfig();
  loadLearnerProfileConfig();
  renderThemeSettingsUI();
  applyFontSize(State.currentFontSize);
  lucide.createIcons();
}
export function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }

// --- inline-handler surface (onclick/onchange="..." targets) ---
window.onModelSelectChange = onModelSelectChange;
window.saveAiConfig = saveAiConfig;
window.saveLearnerProfile = saveLearnerProfile;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
