import {
  acknowledgeMnovaLogIssue,
  buildMnovaContext,
  buildMnovaWelcomeMessage,
  clearMnovaHistory,
  clearMnovaLowPlateTip,
  firstNameFromDisplayName,
  getMnovaHistory,
  getMnovaStarterChips,
  matchesLowPlateChip,
  mnovaDailyLimitHint,
  MNOVA_LOG_FAILURE_CHIP,
  MNOVA_LOW_PLATE_CHIP,
  resolveMnovaFirstName,
  saveMnovaHistory,
  sendMnovaMessage,
} from './mnova-chat.js';
import { mergeMnovaChips, normalizeMnovaChip } from './mnova-action-chips.js';
import { getLocalDisplayName } from './profile.js';
import { bindModalA11y } from './modal-a11y.js';
import { openAuthModal } from './auth-modal.js';
import { APP_NAME } from './brand.js';

let open = false;
let overlayEl = null;
let a11yCleanup = null;
let getCurrentView = () => 'today';
let showToast = () => {};
let onAction = null;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatReply(text = '') {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

export function isMnovaChatOpen() {
  return open;
}

export function openMnovaChat(options = {}) {
  if (open) return;

  const { autoSendChip = null } = options;
  const history = getMnovaHistory();
  let starterChips = getMnovaStarterChips();
  overlayEl = document.createElement('div');
  overlayEl.className = 'camera-modal mnova-chat-sheet';
  overlayEl.setAttribute('role', 'dialog');
  overlayEl.setAttribute('aria-modal', 'true');
  overlayEl.setAttribute('aria-labelledby', 'mnovaChatTitle');

  overlayEl.innerHTML = `
    <div class="camera-modal__panel mnova-chat-panel">
      <header class="mnova-chat-head">
        <div class="mnova-chat-head__brand">
          <span class="mnova-chat-head__avatar" aria-hidden="true">M</span>
          <div>
            <h2 class="mnova-chat-head__title" id="mnovaChatTitle">MNova</h2>
            <p class="mnova-chat-head__sub fine-print">${APP_NAME} assistant · ${escapeHtml(mnovaDailyLimitHint())}</p>
          </div>
        </div>
        <button type="button" class="btn btn-ghost mnova-chat-close" aria-label="Close chat">✕</button>
      </header>
      <div class="mnova-chat-messages" id="mnovaMessages" tabindex="0" role="log" aria-live="polite"></div>
      <div class="mnova-chat-chips" id="mnovaChips" hidden></div>
      <form class="mnova-chat-form" id="mnovaForm">
        <label class="visually-hidden" for="mnovaInput">Message MNova</label>
        <textarea id="mnovaInput" class="mnova-chat-input" rows="1" maxlength="2000" placeholder="Ask about logging, food, or your totals…"></textarea>
        <button type="submit" class="btn btn-primary mnova-chat-send" id="mnovaSend">Send</button>
      </form>
      <p class="fine-print health-disclaimer mnova-chat-disclaimer">${APP_NAME} estimates only — not medical advice.</p>
    </div>
  `;

  document.body.appendChild(overlayEl);
  document.body.style.overflow = 'hidden';
  open = true;

  const messagesEl = overlayEl.querySelector('#mnovaMessages');
  const chipsEl = overlayEl.querySelector('#mnovaChips');
  const form = overlayEl.querySelector('#mnovaForm');
  const input = overlayEl.querySelector('#mnovaInput');
  const sendBtn = overlayEl.querySelector('#mnovaSend');

  function close() {
    if (!open) return;
    open = false;
    a11yCleanup?.();
    a11yCleanup = null;
    overlayEl?.remove();
    overlayEl = null;
    document.body.style.overflow = '';
    document.dispatchEvent(new CustomEvent('mnova-chat-closed'));
  }

  function appendMessage(role, content, { loading = false } = {}) {
    const row = document.createElement('div');
    row.className = `mnova-msg mnova-msg--${role}${loading ? ' mnova-msg--loading' : ''}`;
    if (role === 'assistant') {
      row.innerHTML = `<div class="mnova-msg__bubble"><p>${formatReply(content)}</p></div>`;
    } else {
      row.innerHTML = `<div class="mnova-msg__bubble">${escapeHtml(content)}</div>`;
    }
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  }

  function renderChipButton(chip) {
    const normalized = normalizeMnovaChip(chip);
    if (!normalized) return '';
    if (normalized.type === 'action') {
      const mealAttr = normalized.mealId ? ` data-meal-id="${escapeHtml(normalized.mealId)}"` : '';
      return `<button type="button" class="mnova-chip mnova-chip--action" data-action="${escapeHtml(normalized.action)}"${mealAttr}><span class="mnova-chip__go" aria-hidden="true">→</span>${escapeHtml(normalized.label)}</button>`;
    }
    return `<button type="button" class="mnova-chip" data-chip="${escapeHtml(normalized.label)}">${escapeHtml(normalized.label)}</button>`;
  }

  function renderChips(suggestions = []) {
    const chips = suggestions.length ? suggestions : starterChips;
    if (!chips.length) {
      chipsEl.hidden = true;
      return;
    }
    chipsEl.hidden = false;
    chipsEl.innerHTML = chips.map(renderChipButton).join('');
  }

  function renderHistory(welcomeText = '') {
    messagesEl.innerHTML = '';
    if (!history.length) {
      appendMessage('assistant', welcomeText || buildMnovaWelcomeMessage());
      renderChips(starterChips);
      return;
    }
    for (const turn of history) {
      appendMessage(turn.role, turn.content);
    }
    renderChips([]);
  }

  async function handleSend(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return;

    const askedAboutLogIssue = text === MNOVA_LOG_FAILURE_CHIP
      || /\b(why|couldn't|could not|didn't work|failed|won't log|can't log)\b/i.test(text);
    const askedAboutLowPlate = matchesLowPlateChip(text);

    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    chipsEl.hidden = true;

    let turns = getMnovaHistory();
    turns.push({ role: 'user', content: text });
    appendMessage('user', text);
    const loadingRow = appendMessage('assistant', 'Thinking…', { loading: true });

    const context = await buildMnovaContext({
      currentView: getCurrentView(),
      history: turns.slice(0, -1),
      includeWeekly: true,
    });
    const result = await sendMnovaMessage(text, { history: turns.slice(0, -1), context });

    loadingRow.remove();
    input.disabled = false;
    sendBtn.disabled = false;

    if (!result.ok) {
      if (result.requiresAuth) {
        appendMessage('assistant', 'Sign in to chat with MNova — your meal data stays on your account.');
        openAuthModal({ mode: 'signin', showToast, onSuccess: () => showToast('Signed in — try MNova again') });
      } else {
        appendMessage('assistant', result.error || 'Something went wrong — try again.');
      }
      renderChips(getMnovaStarterChips(context));
      input.focus();
      return;
    }

    if (askedAboutLogIssue) {
      acknowledgeMnovaLogIssue();
    }
    if (askedAboutLowPlate) {
      clearMnovaLowPlateTip();
    }

    turns.push({ role: 'assistant', content: result.reply });
    saveMnovaHistory(turns);
    appendMessage('assistant', result.reply);
    renderChips(mergeMnovaChips(context, result.suggestions || []));
    input.focus();
  }

  if (history.length) {
    renderHistory();
    buildMnovaContext({ currentView: getCurrentView(), history }).then((ctx) => {
      if (!open) return;
      starterChips = getMnovaStarterChips(ctx);
      if (!getMnovaHistory().length) renderChips(starterChips);
    });
  } else {
    const syncWelcome = buildMnovaWelcomeMessage(firstNameFromDisplayName(getLocalDisplayName()));
    renderHistory(syncWelcome);
    Promise.all([
      resolveMnovaFirstName(),
      buildMnovaContext({ currentView: getCurrentView(), history: [] }),
    ]).then(([firstName, ctx]) => {
      if (!open || getMnovaHistory().length) return;
      starterChips = getMnovaStarterChips(ctx);
      const welcomeText = buildMnovaWelcomeMessage(firstName);
      if (welcomeText !== syncWelcome) {
        messagesEl.innerHTML = '';
        appendMessage('assistant', welcomeText);
      }
      renderChips(starterChips);
    });
  }

  if (autoSendChip) {
    queueMicrotask(() => handleSend(autoSendChip));
  } else {
    input.focus();
  }

  overlayEl.querySelector('.mnova-chat-close')?.addEventListener('click', close);
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) close();
  });

  chipsEl.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      onAction?.({
        action: actionBtn.dataset.action,
        mealId: actionBtn.dataset.mealId || undefined,
      });
      close();
      return;
    }
    const btn = e.target.closest('[data-chip]');
    if (!btn) return;
    handleSend(btn.dataset.chip);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSend(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  a11yCleanup = bindModalA11y(overlayEl, {
    onClose: close,
    titleId: 'mnovaChatTitle',
    initialFocus: input,
    panelSelector: '.mnova-chat-panel',
  });

  document.dispatchEvent(new CustomEvent('mnova-chat-opened'));
}

export function closeMnovaChat() {
  if (!open || !overlayEl) return;
  overlayEl.querySelector('.mnova-chat-close')?.click();
}

export function initMnovaChatSheet({ showToast: toastFn, getCurrentView: viewFn, onAction: actionFn } = {}) {
  showToast = toastFn || showToast;
  getCurrentView = viewFn || getCurrentView;
  onAction = actionFn || onAction;
}

export { clearMnovaHistory };
