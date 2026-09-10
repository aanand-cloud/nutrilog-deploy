/**
 * P1 confidence fallback — rename item or pick closest dish (adjust + review).
 */

import { getItemNutritionTrust } from '../../shared/nutrition-item-trust.js';
import {
  applyItemDishRename,
  listEstimateItemEntries,
  needsP1FallbackUi,
  suggestDishNamesForItem,
} from '../../shared/nutrition-item-fallback.js';
import { reportMissingDishLinkHtml, bindReportMissingDish } from './missing-dish-report-ui.js';

/** Consolidated section for the adjust screen. */
export function p1FallbackSectionHtml(analysis = {}) {
  if (!needsP1FallbackUi(analysis)) return '';

  const entries = listEstimateItemEntries(analysis);
  if (!entries.length) return '';

  return `
    <section class="p1-fallback-section" aria-label="Improve rough estimates">
      <h3 class="log-adjust-section__title">Know the dish? <em class="optional-tag">quick fix</em></h3>
      <p class="fine-print log-adjust-section__hint">Rename rough estimates or pick the closest match — no new photo scan.</p>
      <ul class="p1-fallback-list">
        ${entries.map(({ index, item }) => fallbackItemBlockHtml(item, index, analysis)).join('')}
      </ul>
    </section>
  `;
}

/** Inline block under one review item. */
export function p1FallbackItemHtml(item = {}, analysis = {}, itemIndex = 0) {
  if (!needsP1FallbackUi(analysis)) return '';
  if (getItemNutritionTrust(item, analysis) !== 'estimate') return '';
  return fallbackItemBlockHtml(item, itemIndex, analysis, { compact: true });
}

function fallbackItemBlockHtml(item, itemIndex, analysis, { compact = false } = {}) {
  const suggestions = suggestDishNamesForItem(item.name);
  const inputId = `p1FallbackInput-${itemIndex}`;
  const tag = compact ? 'div' : 'li';
  return `
    <${tag} class="p1-fallback-item${compact ? ' p1-fallback-item--compact' : ''}" data-fallback-idx="${itemIndex}">
      ${compact ? '' : `<p class="p1-fallback-item__label">Rough estimate: <strong>${escapeHtml(item.name || 'Item')}</strong></p>`}
      <div class="p1-fallback-item__rename">
        <label class="field p1-fallback-item__field" for="${inputId}">
          <span>Rename</span>
          <input
            type="text"
            id="${inputId}"
            class="p1-fallback-item__input"
            data-fallback-input="${itemIndex}"
            value=""
            placeholder="Type dish name…"
            autocomplete="off"
          />
        </label>
        <button type="button" class="btn btn-ghost btn-sm p1-fallback-item__apply" data-fallback-apply="${itemIndex}">Apply</button>
      </div>
      ${suggestions.length ? `
        <div class="p1-fallback-suggestions" role="group" aria-label="Suggested dishes for ${escapeAttr(item.name || 'item')}">
          ${suggestions.map((s) => `
            <button
              type="button"
              class="p1-fallback-chip"
              data-fallback-pick="${itemIndex}"
              data-ref-id="${escapeAttr(s.refId)}"
              data-label="${escapeAttr(s.label)}"
            >${escapeHtml(s.label)}</button>
          `).join('')}
        </div>
      ` : ''}
      ${reportMissingDishLinkHtml(item, analysis, itemIndex)}
    </${tag}>
  `;
}

function bindP1FallbackControls(root, analysis, onApplied) {
  if (!root || !needsP1FallbackUi(analysis)) return;

  root.querySelectorAll('[data-fallback-apply]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.fallbackApply);
      const input = root.querySelector(`[data-fallback-input="${idx}"]`);
      const label = input?.value?.trim();
      if (!label) {
        input?.focus();
        return;
      }
      onApplied(idx, applyItemDishRename(analysis, idx, label));
    });
  });

  root.querySelectorAll('[data-fallback-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.fallbackPick);
      onApplied(idx, applyItemDishRename(analysis, idx, {
        refId: btn.dataset.refId,
        label: btn.dataset.label,
      }));
    });
  });

  root.querySelectorAll('[data-fallback-input]').forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const idx = Number(input.dataset.fallbackInput);
      const label = input.value?.trim();
      if (!label) return;
      onApplied(idx, applyItemDishRename(analysis, idx, label));
    });
  });
}

/** @param {(next: object) => void} onUpdate */
export function bindP1FallbackSection(root, analysis, onUpdate, showToast) {
  bindP1FallbackControls(root, analysis, (_idx, next) => onUpdate(next));
  bindReportMissingDish(root, analysis, showToast);
}

/** @param {(itemIndex: number, next: object) => void} onUpdate */
export function bindP1FallbackItems(root, analysis, onUpdate, showToast) {
  bindP1FallbackControls(root, analysis, onUpdate);
  bindReportMissingDish(root, analysis, showToast);
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}
