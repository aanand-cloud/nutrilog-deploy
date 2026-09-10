/** Portion presets for meal review — scales all items uniformly from the AI plate estimate. */

export const PORTION_OPTIONS = [
  { id: 'whole', label: 'Whole plate', shortLabel: 'Whole plate', hint: '100%', factor: 1 },
  { id: 'three_quarter', label: 'Most of it (¾)', shortLabel: 'Three quarters', hint: '75%', factor: 0.75 },
  { id: 'half', label: 'About half (½)', shortLabel: 'Half', hint: '50%', factor: 0.5 },
  { id: 'quarter', label: 'About a quarter (¼)', shortLabel: 'Quarter', hint: '25%', factor: 0.25 },
  { id: 'bite', label: 'Small taste', shortLabel: 'Small taste', hint: '10%', factor: 0.1 },
];

export function getPortionOption(id) {
  return PORTION_OPTIONS.find((o) => o.id === id) || PORTION_OPTIONS[0];
}

/**
 * Scale one editable review row by a plate factor (e.g. 0.5 for half plate).
 * @param {object} item
 * @param {number} factor
 * @param {(per100: object, grams: number) => { calories_kcal: number, nutrition: object }} nutritionForAmount
 */
export function scaleEditableItemByFactor(item, factor, nutritionForAmount) {
  const safeFactor = Number(factor);
  if (!item || !Number.isFinite(safeFactor) || safeFactor <= 0) return item;

  const roundAmount = (value, unitKind, displayUnit) => {
    if (displayUnit === 'piece' || unitKind === 'count') {
      return Math.max(1, Math.round(value));
    }
    return Math.round(value * 10) / 10;
  };

  const grams = roundAmount(item.grams * safeFactor, item.unitKind, item.displayUnit);
  const nutritionGrams = roundAmount(
    (item._hiddenGrams ?? item.grams) * safeFactor,
    item.unitKind,
    item.displayUnit,
  );
  const scaled = nutritionForAmount(item.per100, nutritionGrams);

  return {
    ...item,
    grams,
    _hiddenGrams: nutritionGrams,
    calories_kcal: scaled.calories_kcal,
    nutrition: { ...scaled.nutrition },
  };
}

/** Clone editable item state for plate-scale baseline snapshots. */
export function cloneEditableItemBaseline(item = {}) {
  return {
    ...item,
    nutrition: item.nutrition ? { ...item.nutrition } : {},
    per100: item.per100 ? { ...item.per100 } : undefined,
    _per100: item._per100 ? { ...item._per100 } : undefined,
  };
}

export function portionScaleHtml(activeId = 'whole') {
  const active = getPortionOption(activeId);
  const options = PORTION_OPTIONS.map((o) => `
    <option value="${o.id}"${o.id === activeId ? ' selected' : ''}>${escapeHtml(o.label)} — ${escapeHtml(o.hint)}</option>
  `).join('');

  const chips = PORTION_OPTIONS.map((o) => `
    <button
      type="button"
      class="portion-scale__chip${o.id === activeId ? ' is-active' : ''}"
      data-portion="${o.id}"
      aria-pressed="${o.id === activeId ? 'true' : 'false'}"
      title="${escapeAttr(o.shortLabel)}"
    >${escapeHtml(o.hint)}</button>
  `).join('');

  return `
    <div class="portion-scale" role="group" aria-label="How much did you eat?">
      <label class="field portion-scale__field">
        <span class="portion-scale__label">How much did you eat?</span>
        <select class="portion-scale__select settings-select" id="portionPresetSelect" aria-describedby="portionScaleHint">
          ${options}
        </select>
      </label>
      <p class="portion-scale__hint fine-print" id="portionScaleHint">Defaults to the whole entered portion—adjust if you ate less, or set grams / ml on each item below.</p>
      <div class="portion-scale__chips" aria-hidden="false">
        <span class="portion-scale__chips-label">Quick:</span>
        ${chips}
      </div>
    </div>
  `;
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
