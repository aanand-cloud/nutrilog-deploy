/**
 * Topic-aware clarify-step UI — choice chips, preset select + quick chips, numeric g/ml.
 */

import { buildClarifyControlState } from './clarification-memory.js';

export { buildClarifyControlState };

function fieldId(base, scopeId) {
  if (scopeId === '' || scopeId == null) return base;
  return `${base}-${scopeId}`;
}

/**
 * @param {number} current 0-based
 * @param {number} total
 */
export function clarifyProgressDotsHtml(current, total) {
  const dots = Array.from({ length: total }, (_, i) => `
    <span class="clarify-progress__dot${i === current ? ' clarify-progress__dot--active' : ''}${i < current ? ' clarify-progress__dot--done' : ''}" aria-hidden="true"></span>
  `).join('');
  return `
    <div class="clarify-progress" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${current + 1}" aria-label="Question ${current + 1} of ${total}">
      ${dots}
    </div>
  `;
}

/**
 * @param {object} ui
 * @param {object} state
 * @param {{ scopeId?: string }} opts
 */
export function renderClarifyStepControls(ui, state = {}, { scopeId = '' } = {}) {
  switch (ui.controlType) {
    case 'preset_amount':
      return renderPresetAmountControls(ui, state, scopeId);
    case 'text':
      return renderTextControls(ui, state, scopeId);
    case 'choice':
    default:
      return renderChoiceControls(ui, state, scopeId);
  }
}

/**
 * @param {Array<{ question: string, topic: string }>} steps
 * @param {(step: object) => object} getUi
 * @param {Record<string, string>} memory
 */
export function renderClarifyCombinedBlocks(steps, getUi, memory = {}) {
  return steps.map((step, index) => {
    const ui = getUi(step);
    const memoryAnswer = memory[step.topic] || memory[ui.topic] || '';
    const state = buildClarifyControlState(ui, memoryAnswer);
    const scopeId = String(index);
    const memoryHint = state.fromMemory
      ? '<p class="clarify-memory-hint">Pre-filled from your usual log — change if needed</p>'
      : '';

    return `
      <div class="clarify-block" data-step-index="${index}">
        <h3 class="clarify-block__title">${escapeHtml(ui.question)}</h3>
        <p class="clarify-block__helper">${escapeHtml(ui.helper)}</p>
        ${memoryHint}
        ${renderClarifyStepControls(ui, state, { scopeId })}
      </div>
    `;
  }).join('');
}

function renderVisibleCustomField(ui, state = {}, scopeId = '') {
  if (!ui.allowCustom) return '';
  const id = fieldId('clarifyCustomAnswer', scopeId);
  const value = state.customValue ? ` value="${escapeAttr(state.customValue)}"` : '';
  return `
    <label class="field clarify-custom-field clarify-custom-field--visible">
      <span>${escapeHtml(ui.inputLabel || 'Or type your answer')}</span>
      <input
        type="text"
        id="${id}"
        class="clarify-custom-input"
        inputmode="${escapeAttr(ui.inputMode || 'text')}"
        placeholder="${escapeAttr(ui.inputPlaceholder || 'e.g. 2 naan, 300 g, large portion')}"
        autocomplete="off"
        ${value}
      />
    </label>
  `;
}

function renderChoiceControls(ui, state = {}, scopeId = '') {
  const selected = state.selectedChoice || '';
  return `
    <div class="clarify-controls clarify-controls--choice">
      <div class="option-grid clarify-choice-grid" role="listbox" aria-label="Choose an answer">
        ${(ui.options || []).map((o) => `
          <button
            type="button"
            class="option-btn clarify-choice-btn${selected === o ? ' is-selected' : ''}"
            data-answer="${escapeAttr(o)}"
            role="option"
            aria-selected="${selected === o ? 'true' : 'false'}"
          >${escapeHtml(o)}</button>
        `).join('')}
      </div>
      ${renderVisibleCustomField(ui, state, scopeId)}
    </div>
  `;
}

function renderPresetAmountControls(ui, state = {}, scopeId = '') {
  const presets = ui.presets || [];
  const activeId = state.selectedPresetId || presets[0]?.id || '';
  const unit = ui.unit || 'g';
  const unitLabel = unit === 'ml' ? 'ml' : 'g';
  const selectId = fieldId('clarifyPresetSelect', scopeId);
  const numericId = fieldId('clarifyNumericValue', scopeId);
  const numericValue = state.numericValue ? ` value="${escapeAttr(state.numericValue)}"` : '';

  const options = presets.map((p) => `
    <option value="${escapeAttr(p.id)}"${p.id === activeId ? ' selected' : ''}>${escapeHtml(p.label)}</option>
  `).join('');

  const chips = presets.map((p) => `
    <button
      type="button"
      class="portion-item-quick__btn clarify-preset-chip${p.id === activeId ? ' is-selected' : ''}"
      data-preset="${escapeAttr(p.id)}"
      aria-pressed="${p.id === activeId ? 'true' : 'false'}"
    >${escapeHtml(p.chip || p.label)}</button>
  `).join('');

  return `
    <div class="clarify-controls clarify-controls--preset">
      <label class="field clarify-preset-field">
        <span>Pick the closest match</span>
        <select class="settings-select clarify-preset-select" id="${selectId}" aria-describedby="clarifyPresetHint">
          ${options}
        </select>
      </label>
      <div class="portion-item-quick clarify-preset-chips" aria-label="Quick amounts">
        ${chips}
      </div>
      <p class="fine-print clarify-preset-hint">Or enter an exact amount below if you know it.</p>
      <label class="field clarify-numeric-field">
        <span>Exact amount (${unitLabel})</span>
        <div class="clarify-numeric-row">
          <input
            type="number"
            class="clarify-numeric-value"
            id="${numericId}"
            min="${ui.numericMin || 1}"
            max="${ui.numericMax || (unit === 'ml' ? 2000 : 1500)}"
            step="${ui.numericStep || 1}"
            inputmode="decimal"
            placeholder="${unit === 'ml' ? 'e.g. 350' : 'e.g. 300'}"
            ${numericValue}
          />
          <span class="clarify-numeric-unit">${unitLabel}</span>
        </div>
      </label>
      ${renderVisibleCustomField(ui, state, scopeId)}
    </div>
  `;
}

function renderTextControls(ui, state = {}, scopeId = '') {
  const id = fieldId('clarifyCustomAnswer', scopeId);
  const value = state.customValue ? ` value="${escapeAttr(state.customValue)}"` : '';
  return `
    <div class="clarify-controls clarify-controls--text">
      <label class="field">
        <span>${escapeHtml(ui.inputLabel || 'Your answer')}</span>
        <input
          type="text"
          id="${id}"
          inputmode="${escapeAttr(ui.inputMode || 'text')}"
          placeholder="${escapeAttr(ui.inputPlaceholder || '')}"
          ${value}
        />
      </label>
    </div>
  `;
}

/**
 * @param {HTMLElement} scope
 * @param {object} ui
 * @param {{ scopeId?: string }} opts
 */
export function readClarifyAnswer(scope, ui, { scopeId = '' } = {}) {
  const customId = fieldId('clarifyCustomAnswer', scopeId);
  const custom = scope.querySelector(`#${CSS.escape(customId)}`)?.value?.trim() || '';

  if (ui.controlType === 'preset_amount') {
    const numericId = fieldId('clarifyNumericValue', scopeId);
    const numericRaw = scope.querySelector(`#${CSS.escape(numericId)}`)?.value?.trim();
    const numeric = Number(numericRaw);
    if (numericRaw && numeric > 0) {
      const unit = ui.unit === 'ml' ? 'ml' : 'g';
      return `${Math.round(numeric * 10) / 10} ${unit}`;
    }
    if (custom) return custom;
    const selectId = fieldId('clarifyPresetSelect', scopeId);
    const presetId = scope.querySelector(`#${CSS.escape(selectId)}`)?.value
      || scope.querySelector('.clarify-preset-chip.is-selected')?.dataset.preset;
    const preset = (ui.presets || []).find((p) => p.id === presetId);
    if (preset?.answer) return preset.answer;
    return '';
  }

  if (ui.controlType === 'text') {
    return custom;
  }

  if (custom) return custom;
  const selected = scope.querySelector('.clarify-choice-btn.is-selected')?.dataset.answer;
  if (selected) return selected;
  return '';
}

/**
 * @param {HTMLElement} root
 * @param {Array<{ question: string, topic: string }>} steps
 * @param {(step: object) => object} getUi
 */
export function readClarifyCombinedAnswers(root, steps, getUi) {
  return steps.map((step, index) => {
    const block = root.querySelector(`.clarify-block[data-step-index="${index}"]`);
    if (!block) return '';
    const ui = getUi(step);
    return readClarifyAnswer(block, ui, { scopeId: String(index) });
  });
}

/**
 * @param {HTMLElement} scope
 * @param {object} ui
 * @param {{ onChange?: () => void, scopeId?: string }} handlers
 */
export function bindClarifyStepControls(scope, ui, handlers = {}) {
  const { scopeId = '', onChange } = handlers;
  const notify = () => onChange?.();
  const customId = fieldId('clarifyCustomAnswer', scopeId);
  const customInput = () => scope.querySelector(`#${CSS.escape(customId)}`);
  const clearChoiceSelection = () => {
    scope.querySelectorAll('.clarify-choice-btn').forEach((b) => {
      b.classList.remove('is-selected');
      b.setAttribute('aria-selected', 'false');
    });
  };
  const clearCustomInput = () => {
    const input = customInput();
    if (input) input.value = '';
  };

  if (ui.controlType === 'choice') {
    scope.querySelectorAll('.clarify-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        scope.querySelectorAll('.clarify-choice-btn').forEach((b) => {
          b.classList.remove('is-selected');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('is-selected');
        btn.setAttribute('aria-selected', 'true');
        clearCustomInput();
        notify();
      });
    });
    customInput()?.addEventListener('input', () => {
      if (customInput()?.value?.trim()) clearChoiceSelection();
      notify();
    });
    return;
  }

  if (ui.controlType === 'preset_amount') {
    const selectId = fieldId('clarifyPresetSelect', scopeId);
    const select = scope.querySelector(`#${CSS.escape(selectId)}`);
    const syncPresetSelection = (presetId) => {
      if (select && presetId) select.value = presetId;
      scope.querySelectorAll('.clarify-preset-chip').forEach((chip) => {
        const active = chip.dataset.preset === presetId;
        chip.classList.toggle('is-selected', active);
        chip.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    };

    select?.addEventListener('change', () => {
      syncPresetSelection(select.value);
      notify();
    });

    scope.querySelectorAll('.clarify-preset-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        syncPresetSelection(chip.dataset.preset);
        notify();
      });
    });

    const numericId = fieldId('clarifyNumericValue', scopeId);
    scope.querySelector(`#${CSS.escape(numericId)}`)?.addEventListener('input', notify);
    customInput()?.addEventListener('input', notify);
    return;
  }

  customInput()?.addEventListener('input', notify);
}

/**
 * @param {HTMLElement} root
 * @param {Array<{ question: string, topic: string }>} steps
 * @param {(step: object) => object} getUi
 * @param {{ onChange?: () => void }} handlers
 */
export function bindClarifyCombinedControls(root, steps, getUi, handlers = {}) {
  steps.forEach((step, index) => {
    const block = root.querySelector(`.clarify-block[data-step-index="${index}"]`);
    if (!block) return;
    bindClarifyStepControls(block, getUi(step), {
      scopeId: String(index),
      onChange: handlers.onChange,
    });
  });
}

export function clarifyContinueHint(ui, { combined = false } = {}) {
  if (combined) {
    return 'Answer both questions (or use your pre-filled usual answers), then tap Continue.';
  }
  if (ui.controlType === 'preset_amount') {
    return 'Pick a preset, enter grams or ml, or type below — then tap Continue.';
  }
  if (ui.controlType === 'choice') {
    return 'Tap an option or type your answer below, then tap Continue.';
  }
  return 'Enter your answer, then tap Continue.';
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}
