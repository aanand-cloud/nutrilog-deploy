import { openMnovaChat, closeMnovaChat, isMnovaChatOpen, initMnovaChatSheet } from './mnova-chat-sheet.js';
import { isOnboardingWizardOpen } from './onboarding-wizard.js';

let bubbleEl = null;
let getCurrentView = () => 'today';
let isLogBusyFn = () => false;
let isLoggedInFn = () => false;
let modalObserver = null;

function otherModalOpen() {
  return [...document.querySelectorAll('.camera-modal')].some(
    (el) => !el.classList.contains('mnova-chat-sheet'),
  );
}

function shouldHideBubble() {
  if (!isLoggedInFn()) return true;
  if (isOnboardingWizardOpen()) return true;
  if (isMnovaChatOpen()) return true;
  if (otherModalOpen()) return true;
  if (getCurrentView() === 'log' && isLogBusyFn()) return true;
  return false;
}

/** Keep bubble visibility in sync — safe to call often; no MutationObserver loops. */
export function refreshMnovaBubble() {
  if (!bubbleEl) return;
  const hide = shouldHideBubble();
  if (bubbleEl.hidden !== hide) bubbleEl.hidden = hide;
}

function onDomChange() {
  requestAnimationFrame(refreshMnovaBubble);
}

export function initMnovaBubble({ showToast, getCurrentView: viewFn, isLogBusy, isLoggedIn, onAction } = {}) {
  getCurrentView = viewFn || getCurrentView;
  isLogBusyFn = isLogBusy || isLogBusyFn;
  isLoggedInFn = isLoggedIn || isLoggedInFn;
  initMnovaChatSheet({ showToast, getCurrentView: viewFn, onAction });

  if (bubbleEl) {
    refreshMnovaBubble();
    return;
  }

  bubbleEl = document.createElement('button');
  bubbleEl.type = 'button';
  bubbleEl.className = 'mnova-bubble';
  bubbleEl.setAttribute('aria-label', 'Open MNova assistant');
  bubbleEl.innerHTML = `
    <span class="mnova-bubble__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </span>
    <span class="mnova-bubble__label">MNova</span>
  `;

  bubbleEl.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMnovaChatOpen()) return;
    openMnovaChat();
    refreshMnovaBubble();
  });

  document.body.appendChild(bubbleEl);
  refreshMnovaBubble();

  document.addEventListener('mnova-chat-opened', refreshMnovaBubble);
  document.addEventListener('mnova-chat-closed', refreshMnovaBubble);
  document.addEventListener('mnova-log-issue', () => {
    bubbleEl?.classList.add('mnova-bubble--has-tip');
    refreshMnovaBubble();
  });
  document.addEventListener('mnova-log-issue-cleared', () => {
    bubbleEl?.classList.remove('mnova-bubble--has-tip');
  });
  document.addEventListener('mnova-low-plate-tip', () => {
    bubbleEl?.classList.add('mnova-bubble--has-tip');
    refreshMnovaBubble();
  });
  document.addEventListener('mnova-low-plate-tip-cleared', () => {
    bubbleEl?.classList.remove('mnova-bubble--has-tip');
    refreshMnovaBubble();
  });
  window.addEventListener('resize', refreshMnovaBubble);

  // Modal open/close only — never observe attribute changes (hidden toggles caused infinite loop).
  if (!modalObserver) {
    modalObserver = new MutationObserver(onDomChange);
    modalObserver.observe(document.body, { childList: true, subtree: true });
  }
}

export { openMnovaChat, closeMnovaChat, isMnovaChatOpen };
