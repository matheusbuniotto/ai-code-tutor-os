// =========================================================================
// 8. CHAT MESSAGE STREAM: composer, SSE streaming, compaction, edit & resend
// =========================================================================
// The session-list half of the old section 7+8 blob lives in threads.js.

import { API_BASE, State } from './state.js';
import { escapeHtml } from './utils.js';
import { renderMarkdown, renderThought } from './markdown.js';
import { autoScroll, scrollToBottom } from './ui-utils.js';
import {
  currentIdleConductorLabel,
  getAgentDelegationInfo,
  updateConductorBadge,
} from './agents.js';
import { loadThreadsList } from './threads.js';
import { loadWorkspaceData } from './workspace.js';

export async function handleChatSubmit(e) {
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

export function appendSystemNoticeCard(innerHtml) {
  const messagesContainer = document.getElementById('messages-container');
  const card = document.createElement('div');
  card.className = "flex justify-center";
  card.innerHTML = `<div class="notice-body theme-card border theme-border rounded-xl px-3.5 py-2 text-[11px] font-mono flex items-center gap-2" style="color: var(--text-muted);">${innerHtml}</div>`;
  messagesContainer.appendChild(card);
  scrollToBottom();
  return card.querySelector('.notice-body');
}

// Real transparency: shows the actual summary (expandable), not just "it was compacted".
export function appendCompactSummaryCard(count, summaryText) {
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

export async function triggerManualCompact() {
  const notice = appendSystemNoticeCard(`<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Compactando conversa...</span>`);
  lucide.createIcons();
  try {
    const res = await fetch(`${API_BASE}/api/thread/compact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: State.activeThreadId })
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
export function buildUserMessageHTML(text) {
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

export function buildUserMessageBlock(msgId, text) {
  const userBlock = document.createElement('div');
  userBlock.className = "flex justify-end group";
  if (msgId) userBlock.dataset.msgId = msgId;
  userBlock.innerHTML = buildUserMessageHTML(text);
  return userBlock;
}

// Module-private: only the edit flow below ever touches this.
const editOriginalText = {};

export function startEditMessage(btnEl) {
  if (State.currentAbortController) return; // don't edit while a response is being generated
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

export function handleEditKeydown(e, msgId) {
  if (e.key === 'Escape') {
    e.preventDefault();
    cancelEditMessage(msgId);
  } else if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitEditMessage(msgId);
  }
}

export function cancelEditMessage(msgId) {
  const wrapper = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (!wrapper) return;
  wrapper.innerHTML = buildUserMessageHTML(editOriginalText[msgId] || '');
  lucide.createIcons();
}

export async function submitEditMessage(msgId) {
  const ta = document.getElementById(`edit-ta-${msgId}`);
  const newText = ta ? ta.value.trim() : '';
  if (!newText) return;

  const wrapper = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (!wrapper) return;

  try {
    const res = await fetch(`${API_BASE}/api/thread/truncate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: State.activeThreadId, fromMessageId: msgId })
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

export async function sendChatMessage(text) {
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
  State.currentAbortController = new AbortController();
  const pendingToolSteps = new Map();

  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        agentId: activeAgentId,
        threadId: State.activeThreadId,
      }),
      signal: State.currentAbortController.signal
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
    State.currentAbortController = null;
    loadThreadsList();
    // The agent may have called meta_set_now/phase_set/workspace_write during the turn —
    // reload NOW.md + the file tree so the sidebar doesn't go stale.
    loadWorkspaceData();
    autoScroll();
    lucide.createIcons();
  }
}

export function stopGeneration() {
  if (State.currentAbortController) {
    const btn = document.getElementById('stop-btn');
    if (btn) btn.classList.add('opacity-50', 'pointer-events-none');
    State.currentAbortController.abort();
  }
}

// --- inline-handler surface (onclick/onsubmit/onkeydown="..." targets) ---
window.handleChatSubmit = handleChatSubmit;
window.triggerManualCompact = triggerManualCompact;
window.startEditMessage = startEditMessage;
window.handleEditKeydown = handleEditKeydown;
window.cancelEditMessage = cancelEditMessage;
window.submitEditMessage = submitEditMessage;
window.sendChatMessage = sendChatMessage;
window.stopGeneration = stopGeneration;
