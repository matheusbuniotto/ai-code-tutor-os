// =========================================================================
// 5 + 6. SCROLL MANAGEMENT & TEXTAREA AUTO-RESIZE
// =========================================================================
// Two tiny sections in the old app.js, merged: both are dumb chrome around
// the chat canvas with no state of their own beyond `userScrolledUp`.

import { State } from './state.js';

const chatFeed = document.getElementById('chat-feed');
const scrollBottomBtn = document.getElementById('scroll-bottom-btn');

chatFeed.addEventListener('scroll', () => {
  const isAtBottom = chatFeed.scrollHeight - chatFeed.scrollTop - chatFeed.clientHeight < 120;
  State.userScrolledUp = !isAtBottom;
  if (State.userScrolledUp) {
    scrollBottomBtn.classList.remove('hidden');
  } else {
    scrollBottomBtn.classList.add('hidden');
  }
});

export function scrollToBottom() {
  chatFeed.scrollTop = chatFeed.scrollHeight;
  State.userScrolledUp = false;
  scrollBottomBtn.classList.add('hidden');
}

export function autoScroll() {
  if (!State.userScrolledUp) {
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }
}

export function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight) + 'px';
}

export function handleInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('chat-form').dispatchEvent(new Event('submit'));
  }
}

export function quickPrompt(text) {
  const input = document.getElementById('chat-input');
  input.value = text;
  autoResizeTextarea(input);
  document.getElementById('chat-form').dispatchEvent(new Event('submit'));
}

// --- inline-handler surface (onclick/oninput/onkeydown="..." targets) ---
window.scrollToBottom = scrollToBottom;
window.autoResizeTextarea = autoResizeTextarea;
window.handleInputKeydown = handleInputKeydown;
window.quickPrompt = quickPrompt;
