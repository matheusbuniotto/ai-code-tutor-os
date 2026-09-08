// =========================================================================
// FIRST-RUN ONBOARDING WIZARD — personalizes the 3-Gate Filter & profile
// =========================================================================

import { API_BASE } from './state.js';

const DISMISSED_KEY = 'tutor_onboarding_dismissed';

export async function maybeShowOnboarding() {
  if (localStorage.getItem(DISMISSED_KEY)) return;
  try {
    const res = await fetch(`${API_BASE}/api/config/learner-profile`);
    const data = await res.json();
    const profile = data && data.profile;
    // Only offer the wizard while the profile is still fully generic.
    const isGeneric = profile && (!profile.name || profile.name === 'you') && !profile.domainLabel;
    if (!isGeneric) return;
    document.getElementById('onboarding-modal').classList.remove('hidden');
    lucide.createIcons();
  } catch (e) {}
}

// Used after a workspace reset/import so the wizard is offered again on reload.
export function clearOnboardingDismissed() {
  localStorage.removeItem(DISMISSED_KEY);
}

export function skipOnboarding() {
  localStorage.setItem(DISMISSED_KEY, '1');
  document.getElementById('onboarding-modal').classList.add('hidden');
}

// Escape / backdrop close: just hides the modal, does NOT set the dismissed
// flag — an error alert or accidental Escape shouldn't silently opt the
// learner out of onboarding forever. Only the explicit "Skip for now" button
// (skipOnboarding) and a successful save do that.
export function closeOnboarding() {
  document.getElementById('onboarding-modal').classList.add('hidden');
}

export async function saveOnboarding() {
  const payload = {
    name: document.getElementById('ob-name').value.trim() || 'you',
    domainLabel: document.getElementById('ob-domain-label').value.trim(),
    workRole: document.getElementById('ob-work-role').value.trim(),
    careerHorizon: document.getElementById('ob-career-horizon').value.trim(),
  };
  try {
    const res = await fetch(`${API_BASE}/api/config/learner-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) throw new Error('save failed');

    const arcsChoice = document.querySelector('input[name="ob-arcs-choice"]:checked')?.value;
    if (arcsChoice === 'example') {
      await fetch(`${API_BASE}/api/arcs/seed-example`, { method: 'POST' });
    }

    localStorage.setItem(DISMISSED_KEY, '1');
    document.getElementById('onboarding-modal').classList.add('hidden');
    alert('Saved. Restart the backend server for agents to pick up your profile.');
  } catch (err) {
    alert(`Error saving profile: ${err.message}`);
  }
}

window.skipOnboarding = skipOnboarding;
window.saveOnboarding = saveOnboarding;
