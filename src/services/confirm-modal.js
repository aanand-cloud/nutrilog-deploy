import { setupModalA11y, bindModalA11y } from './modal-a11y.js';

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/**
 * Branded confirm dialog (replaces window.confirm).
 * @returns {Promise<boolean>}
 */
export function openConfirmModal({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
} = {}) {
  return new Promise((resolve) => {
    let done = false;
    let cleanup = null;
    const overlay = document.createElement('div');
    overlay.className = 'camera-modal confirm-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'confirmModalTitle');

    function finish(value) {
      if (done) return;
      done = true;
      cleanup?.();
      overlay.remove();
      document.body.style.overflow = '';
      resolve(Boolean(value));
    }

    overlay.innerHTML = `
      <div class="camera-modal__panel confirm-modal__panel">
        <h2 class="confirm-modal__title" id="confirmModalTitle">${escapeHtml(title)}</h2>
        ${message ? `<p class="confirm-modal__message">${escapeHtml(message)}</p>` : ''}
        <div class="camera-modal__actions confirm-modal__actions">
          <button type="button" class="btn btn-ghost" id="confirmModalCancel">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}" id="confirmModalOk">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    cleanup = bindModalA11y(overlay, {
      onClose: () => finish(false),
      titleId: 'confirmModalTitle',
      initialFocus: overlay.querySelector('#confirmModalCancel'),
    });

    overlay.querySelector('#confirmModalCancel')?.addEventListener('click', () => finish(false));
    overlay.querySelector('#confirmModalOk')?.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });
  });
}

/**
 * Branded typed confirmation (replaces window.prompt for DELETE).
 * @returns {Promise<boolean>}
 */
export function openTypedConfirmModal({
  title,
  message,
  expected = 'DELETE',
  confirmLabel = 'Delete permanently',
  inputLabel = `Type ${expected} to confirm`,
} = {}) {
  return new Promise((resolve) => {
    let done = false;
    let cleanup = null;
    const overlay = document.createElement('div');
    overlay.className = 'camera-modal confirm-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'typedConfirmTitle');

    function finish(value) {
      if (done) return;
      done = true;
      cleanup?.();
      overlay.remove();
      document.body.style.overflow = '';
      resolve(Boolean(value));
    }

    overlay.innerHTML = `
      <div class="camera-modal__panel confirm-modal__panel">
        <h2 class="confirm-modal__title" id="typedConfirmTitle">${escapeHtml(title)}</h2>
        <p class="confirm-modal__message">${escapeHtml(message)}</p>
        <label class="field full">
          <span>${escapeHtml(inputLabel)}</span>
          <input type="text" id="typedConfirmInput" autocomplete="off" spellcheck="false"/>
        </label>
        <div class="camera-modal__actions confirm-modal__actions">
          <button type="button" class="btn btn-ghost" id="typedConfirmCancel">Cancel</button>
          <button type="button" class="btn btn-danger" id="typedConfirmOk" disabled>${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const input = overlay.querySelector('#typedConfirmInput');
    const okBtn = overlay.querySelector('#typedConfirmOk');
    input?.addEventListener('input', () => {
      if (okBtn) okBtn.disabled = input.value.trim() !== expected;
    });

    cleanup = bindModalA11y(overlay, {
      onClose: () => finish(false),
      titleId: 'typedConfirmTitle',
      initialFocus: input,
    });

    overlay.querySelector('#typedConfirmCancel')?.addEventListener('click', () => finish(false));
    okBtn?.addEventListener('click', () => {
      if (input?.value.trim() === expected) finish(true);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });
  });
}
