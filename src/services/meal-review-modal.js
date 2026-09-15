import { MEAL_TYPES, defaultMealType } from './meal-types.js';
import { getUnitPrefs, formatEnergy } from './goals.js';
import { DISCLAIMERS, disclaimerBlock } from './disclaimers.js';
import { scoreMealConfidence, CONFIDENCE_BAND_META, whyThisEstimate } from '../../shared/nutrition-confidence.js';
import {
  scaleItemsByEatenFactor,
  sumCaloriesPrecise,
  sumConsumedGrams,
  sumOriginalGrams,
  sumNutritionHonest,
  formatNutrientLine,
  roundDisplay,
} from './eaten-amount.js';
import {
  PORTION_UNITS,
  keepsUnderlyingGrams,
  displayAmountFromGrams,
  gramsFromDisplayAmount,
  householdEquivalentLabel,
  portionSourceLabel,
} from './household-portions.js';
import { bindModalA11y } from './modal-a11y.js';
import { openConfirmModal } from './confirm-modal.js';
import { openFoodSearchModal } from './food-search-modal.js';
import { lookupFoodProduct } from './food-search.js';
import {
  clampOilTbsp,
  isLowConfidenceItem,
  isVisionReviewMeal,
  mealOilTbspFromItems,
  rebuildVisionReview,
} from '../../shared/vision-review-adjust.js';
import {
  canonicalPieceGrams,
  isBreadItemText,
  parseExplicitPieceCount,
  resolveBreadReference,
} from '../../shared/bread-piece-grams.js';
import { matchFoodReference, parseGramsFromText } from '../../shared/nutrition-density.js';

/** Interactive review before saving an AI scan. */
export function openMealReviewModal(analysis, { mealType = defaultMealType(), imageDataUrl = null } = {}) {
  return new Promise((resolve) => {
    const prefs = getUnitPrefs();
    let items = normalizeEditableItems(analysis.items || []);
    let currentMealType = mealType;
    const eatenFactor = 1;
    let addName = '';
    let addGrams = 15;
    let addCalories = 120;
    let a11yCleanup = null;
    let changeTargetId = null;
    const visionMode = isVisionReviewMeal(analysis);
    let mealOilTbsp = mealOilTbspFromItems(items);

    function applyVisionRebuild(nextItems, oilTbsp) {
      const rebuilt = rebuildVisionReview(analysis, nextItems, oilTbsp);
      analysis = rebuilt.analysis;
      items = normalizeEditableItems(rebuilt.items);
      mealOilTbsp = clampOilTbsp(oilTbsp);
    }

    function commitWeightInput(input) {
      const id = input.dataset.weight;
      const item = items.find((i) => i.id === id);
      if (!item) return;
      const unitId = item._displayUnit || 'g';
      const grams = itemGramsFromDisplay(item, Number(input.value), unitId);
      if (!(grams > 0)) return;
      items = items.map((i) => (i.id === id ? { ...scaleItem(i, grams), _userEnteredWeight: true } : i));
    }

    const overlay = document.createElement('div');
    overlay.className = 'camera-modal meal-review-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'mealReviewTitle');

    function totals() {
      const scaled = scaleItemsByEatenFactor(items, eatenFactor);
      const kcal = sumCaloriesPrecise(scaled);
      const nutrition = sumNutritionHonest(scaled);
      return {
        meal_summary: analysis.meal_summary,
        total_calories_kcal: kcal,
        total_nutrition: nutrition,
        consumedGrams: sumConsumedGrams(scaled),
        originalGrams: sumOriginalGrams(scaled),
        scaled,
      };
    }

    function drinkOnlyReview() {
      return items.length > 0 && items.every((item) => isDrinkReviewItem(item) || item._drinkAddon);
    }

    function render() {
      const focusToken = captureFocusToken(overlay);
      const t = totals();
      const preview = {
        ...analysis,
        items: t.scaled,
        total_calories_kcal: t.total_calories_kcal,
      };
      const scored = scoreMealConfidence(preview);
      const band = CONFIDENCE_BAND_META[scored.band] || CONFIDENCE_BAND_META.medium;
      const nutrients = formatNutrientLine(t.total_nutrition);
      const hideOil = drinkOnlyReview();
      overlay.innerHTML = `
        <div class="camera-modal__panel meal-review-panel">
          <header class="meal-review-head">
            <p class="step-label">Review</p>
            <h2 class="barcode-title" id="mealReviewTitle">We found ${items.length} food${items.length === 1 ? '' : 's'} — please check them</h2>
          </header>
          ${imageDataUrl ? `<img src="${imageDataUrl}" alt="Your meal photo" class="preview-img preview-img--small meal-review-photo"/>` : ''}
          <p class="step-label">When did you eat this?</p>
          <div class="meal-type-row meal-review-types" id="reviewMealTypes">
            ${MEAL_TYPES.map((mt) => `
              <button type="button" class="meal-type-btn ${currentMealType === mt.id ? 'meal-type-btn--active' : ''}" data-type="${mt.id}">
                ${mt.icon} ${mt.label}
              </button>
            `).join('')}
          </div>
          <div class="meal-review-summary">
            <p class="review-kcal">Estimated: ${Math.round(t.total_calories_kcal)} kcal</p>
            ${scored.kcalRange ? `<p>Likely range: ${scored.kcalRange.min}–${scored.kcalRange.max} kcal</p>` : ''}
            <p class="${band.className}">${escapeHtml(band.label)}</p>
            ${scored.primaryUncertainty ? `<p class="fine-print">Main uncertainty: ${escapeHtml(scored.primaryUncertainty)}</p>` : ''}
            <p class="fine-print">P ${fmtMaybe(t.total_nutrition.protein_g)} · C ${fmtMaybe(t.total_nutrition.carbs_g)} · F ${fmtMaybe(t.total_nutrition.fat_g)}</p>
            <p class="fine-print">${escapeHtml(nutrients.line)}</p>
            ${nutrients.notes ? `<p class="fine-print">${escapeHtml(nutrients.notes)}</p>` : ''}
            <p class="fine-print">${hideOil ? `${roundDisplay(t.consumedGrams)} ml` : `${roundDisplay(t.consumedGrams)} g on the plate`}</p>
          </div>
          ${visionMode && !hideOil ? `
          <div class="meal-review-oil" role="group" aria-label="Cooking oil">
            <span>Cooking oil / ghee</span>
            <div class="meal-review-stepper">
              <button type="button" class="btn btn-ghost btn-sm" data-oil-delta="-0.5" aria-label="Less oil">−</button>
              <strong>${mealOilTbsp} tbsp</strong>
              <button type="button" class="btn btn-ghost btn-sm" data-oil-delta="0.5" aria-label="More oil">+</button>
            </div>
          </div>` : ''}
          <p class="step-label">Foods on the plate</p>
          <ul class="meal-review-items" id="reviewItemsList">
            ${t.scaled.map((item) => itemRow(item)).join('')}
          </ul>
          <div class="meal-review-bulk">
            <button type="button" class="btn btn-ghost btn-sm" id="combineItems">Combine last two foods</button>
            <button type="button" class="btn btn-ghost btn-sm" id="splitLast">Split last food</button>
          </div>
          <details class="meal-review-why">
            <summary>Why this estimate?</summary>
            <pre class="fine-print">${escapeHtml(whyThisEstimate(preview))}</pre>
          </details>
          <details class="meal-review-add" ${changeTargetId ? 'open' : ''}>
            <summary>${changeTargetId ? 'Change a food' : 'Add a missing food'}</summary>
            <div class="meal-review-add-form">
              <label class="field full">
                <span>Name</span>
                <input type="text" id="addItemName" placeholder="${hideOil ? 'e.g. Oat milk' : 'e.g. Cooking oil — 1 tbsp'}" value="${escapeAttr(addName)}"/>
              </label>
              <div class="meal-review-add-row">
                <label class="field">
                  <span>${hideOil ? 'Amount (ml)' : 'Amount (g)'}</span>
                  <input type="number" id="addItemGrams" min="1" step="1" value="${addGrams}"/>
                </label>
                <label class="field">
                  <span>Energy (kcal)</span>
                  <input type="number" id="addItemCalories" min="0" step="1" value="${addCalories}"/>
                </label>
              </div>
              <button type="button" class="btn btn-ghost btn-sm full" id="addItemBtn">${changeTargetId ? 'Replace food' : 'Add item'}</button>
              <button type="button" class="btn btn-ghost btn-sm full" id="searchFoodBtn">Search packaged food</button>
            </div>
          </details>
          ${disclaimerBlock(DISCLAIMERS.nutritionEstimate, 'fine-print health-disclaimer')}
          <div class="camera-modal__actions full meal-review-actions">
            <button type="button" class="btn btn-ghost" id="reviewCancel">Cancel</button>
            <button type="button" class="btn btn-primary" id="reviewConfirm">Continue</button>
          </div>
        </div>
      `;
      bindEvents();
      restoreFocusToken(overlay, focusToken);
    }

    function itemRow(item) {
      const drinkItem = isDrinkReviewItem(item);
      const sugarAddon = item._drinkAddon === 'sugar';
      const unitId = sugarAddon ? 'g' : (drinkItem ? 'ml' : (item._displayUnit || 'g'));
      const original = item._originalGrams ?? item.grams;
      const amount = (unitId === 'piece' || unitId === 'slice') && Number(item._pieceCount) > 0
        ? Number(item._pieceCount)
        : itemDisplayFromGrams(item, original, unitId);
      const match = item._unmatched ? 'Nutrition match needed' : 'Matched';
      const source = portionSourceLabel(item);
      const low = isLowConfidenceItem(item);
      const amountLabel = drinkItem && !sugarAddon
        ? `${roundDisplay(amount)} ml`
        : householdEquivalentLabel(original, unitId, amount);
      return `
        <li class="meal-review-item${low ? ' meal-review-item--low' : ''}${item._visionOil ? ' meal-review-item--oil' : ''}" data-id="${item.id}">
          <div class="meal-review-item-head">
            <strong>${escapeHtml(item.name)}</strong>
            ${low ? '<span class="meal-review-low">Check this</span>' : ''}
            <button type="button" class="btn-icon meal-review-delete" data-delete="${item.id}" aria-label="Remove ${escapeAttr(item.name)}">✕</button>
          </div>
          <p class="fine-print">${escapeHtml(amountLabel)} · ${source} · ${match}</p>
          <p class="fine-print">${escapeHtml(item.portion_estimate || '')}</p>
          <div class="meal-review-item-controls">
            ${visionMode && !item._visionOil && !drinkItem ? `
            <div class="meal-review-stepper meal-review-stepper--grams">
              <button type="button" class="btn btn-ghost btn-sm" data-gram-delta="${item.id}" data-step="-10" aria-label="Less ${escapeAttr(item.name)}">−</button>
              <button type="button" class="btn btn-ghost btn-sm" data-gram-delta="${item.id}" data-step="10" aria-label="More ${escapeAttr(item.name)}">+</button>
            </div>` : ''}
            <label class="field meal-review-weight">
              <span>Amount</span>
              <input type="number" min="0.1" step="0.1" value="${roundDisplay(amount, 1)}" data-weight="${item.id}"/>
            </label>
            ${drinkItem && !sugarAddon ? `
            <span class="meal-review-unit fine-print">ml</span>` : `
            <label class="field meal-review-unit">
              <span>Unit</span>
              <select data-unit="${item.id}" aria-label="Portion unit for ${escapeAttr(item.name)}">
                ${PORTION_UNITS.map((u) => `<option value="${u.id}" ${u.id === unitId ? 'selected' : ''}>${escapeHtml(u.label)}</option>`).join('')}
              </select>
            </label>`}
            <span class="meal-review-item-kcal">${formatEnergy(Math.round(item.calories_kcal), prefs)}</span>
          </div>
          <div class="meal-review-item-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-change="${item.id}">Change food</button>
            <button type="button" class="btn btn-ghost btn-sm" data-not-on-plate="${item.id}">Not on my plate</button>
          </div>
        </li>
      `;
    }

    function bindEvents() {
      overlay.querySelector('#reviewCancel')?.addEventListener('click', () => close(null));
      overlay.querySelector('#reviewConfirm')?.addEventListener('click', () => {
        overlay.querySelectorAll('[data-weight]').forEach((input) => commitWeightInput(input));
        const t = totals();
        const preview = { ...analysis, items: t.scaled, total_calories_kcal: t.total_calories_kcal };
        const scored = scoreMealConfidence(preview);
        close({
          analysis: {
            ...analysis,
            meal_summary: t.meal_summary,
            total_calories_kcal: t.total_calories_kcal,
            total_nutrition: t.total_nutrition,
            items: t.scaled.map(toSavedItem),
            _confidence: scored,
            _consumedGrams: t.consumedGrams,
            _originalGrams: t.originalGrams,
            _eatenFactor: eatenFactor,
            confidence_score: scored.score,
            _originalEstimate: {
              total_calories_kcal: t.total_calories_kcal / (eatenFactor || 1),
              items: items.map(toSavedItem),
            },
          },
          mealType: currentMealType,
        });
      });

      overlay.querySelectorAll('#reviewMealTypes .meal-type-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentMealType = btn.dataset.type;
          overlay.querySelectorAll('#reviewMealTypes .meal-type-btn').forEach((el) => {
            el.classList.toggle('meal-type-btn--active', el.dataset.type === currentMealType);
          });
        });
      });

      overlay.querySelectorAll('[data-weight]').forEach((input) => {
        input.addEventListener('change', () => commitWeightInput(input));
        input.addEventListener('blur', () => commitWeightInput(input));
      });

      overlay.querySelectorAll('[data-gram-delta]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.gramDelta;
          const item = items.find((i) => i.id === id);
          if (!item) return;
          const step = Number(btn.dataset.step) || 10;
          const next = Math.max(1, Math.round((Number(item._originalGrams || item.grams) || 100) + step));
          items = items.map((i) => (i.id === id ? { ...scaleItem(i, next), _userEnteredWeight: true } : i));
          render();
        });
      });

      overlay.querySelectorAll('[data-oil-delta]').forEach((btn) => {
        btn.addEventListener('click', () => {
          applyVisionRebuild(items, clampOilTbsp(mealOilTbsp + Number(btn.dataset.oilDelta)));
          render();
        });
      });

      overlay.querySelectorAll('[data-unit]').forEach((select) => {
        select.addEventListener('change', () => {
          const id = select.dataset.unit;
          const item = items.find((i) => i.id === id);
          if (!item) return;
          const nextUnit = select.value;
          if (nextUnit === 'unsure') {
            items = items.map((i) => (i.id === id ? { ...i, _displayUnit: nextUnit, _portionUnsure: true } : i));
            render();
            return;
          }
          if (keepsUnderlyingGrams(nextUnit) && keepsUnderlyingGrams(item._displayUnit || 'g')) {
            items = items.map((i) => (i.id === id ? { ...i, _displayUnit: nextUnit } : i));
          } else {
          const grams = itemGramsFromDisplay(item, 1, nextUnit);
            items = items.map((i) => (i.id === id ? { ...scaleItem(i, grams), _displayUnit: nextUnit } : i));
          }
          render();
        });
      });

      overlay.querySelectorAll('[data-delete], [data-not-on-plate]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.delete || btn.dataset.notOnPlate;
          const item = items.find((i) => i.id === id);
          const ok = await openConfirmModal({
            title: 'Remove this food?',
            message: item ? `${item.name} will be taken off this meal.` : 'Remove this food from the meal?',
            confirmLabel: 'Remove',
            tone: 'danger',
          });
          if (!ok) return;
          items = items.filter((i) => i.id !== id);
          render();
        });
      });

      overlay.querySelectorAll('[data-change]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = items.find((i) => i.id === btn.dataset.change);
          changeTargetId = btn.dataset.change;
          addName = item?.name || '';
          addGrams = roundDisplay(item?._originalGrams || item?.grams || 100);
          addCalories = Math.round(item?._originalCalories || item?.calories_kcal || 0);
          render();
        });
      });

      overlay.querySelector('#combineItems')?.addEventListener('click', () => {
        if (items.length < 2) return;
        const a = items[items.length - 2];
        const b = items[items.length - 1];
        const grams = (a._originalGrams || 0) + (b._originalGrams || 0);
        const calories = (a._originalCalories || 0) + (b._originalCalories || 0);
        const merged = {
          ...a,
          name: `${a.name} + ${b.name}`,
          grams,
          baseGrams: grams,
          _originalGrams: grams,
          _originalCalories: calories,
          calories_kcal: calories,
          baseCalories: calories,
          nutrition: addNutrition(a._originalNutrition, b._originalNutrition),
          _originalNutrition: addNutrition(a._originalNutrition, b._originalNutrition),
          portion_estimate: `Combined · ${roundDisplay(grams)} g`,
        };
        items = [...items.slice(0, -2), merged];
        render();
      });

      overlay.querySelector('#splitLast')?.addEventListener('click', () => {
        const last = items[items.length - 1];
        if (!last) return;
        const halfG = (last._originalGrams || last.grams || 0) / 2;
        const halfK = (last._originalCalories || last.calories_kcal || 0) / 2;
        items = [
          ...items.slice(0, -1),
          scaleItem({ ...last, id: `${last.id}-a` }, halfG),
          scaleItem({ ...last, id: `${last.id}-b`, name: `${last.name} (part 2)` }, halfG),
        ];
        if (halfK) {
          /* scaleItem already scaled calories from grams */
        }
        render();
      });

      overlay.querySelector('#addItemBtn')?.addEventListener('click', () => {
        addName = overlay.querySelector('#addItemName')?.value.trim() || '';
        addGrams = Number(overlay.querySelector('#addItemGrams')?.value) || 15;
        addCalories = Number(overlay.querySelector('#addItemCalories')?.value) || 0;
        if (!addName) return;
        const added = createManualItem(addName, addGrams, addCalories, drinkOnlyReview() ? 'ml' : 'g');
        if (changeTargetId) {
          items = items.map((i) => (i.id === changeTargetId ? { ...added, id: i.id } : i));
          changeTargetId = null;
        } else {
          items.push(added);
        }
        addName = '';
        render();
      });

      overlay.querySelector('#searchFoodBtn')?.addEventListener('click', async () => {
        try {
          const code = await openFoodSearchModal();
          if (!code) return;
          const product = await lookupFoodProduct(code);
          const line = product.items?.[0];
          if (!line) return;
          const grams = parseGrams(line.portion_estimate) || 100;
          const mapped = {
            ...createManualItem(line.name, grams, Number(line.calories_kcal) || 0),
            nutrition: { ...(line.nutrition || {}) },
            _originalNutrition: { ...(line.nutrition || {}) },
            _labelBacked: Boolean(product._labelBacked),
            _unmatched: false,
            portion_estimate: line.portion_estimate,
          };
          if (changeTargetId) {
            items = items.map((i) => (i.id === changeTargetId ? { ...mapped, id: i.id } : i));
            changeTargetId = null;
          } else {
            items.push(mapped);
          }
          render();
        } catch (err) {
          overlay.querySelector('#addItemName')?.focus();
        }
      });
    }

    function close(result) {
      a11yCleanup?.();
      overlay.remove();
      document.body.style.overflow = '';
      resolve(result);
    }

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    a11yCleanup = bindModalA11y(overlay, {
      onClose: () => close(null),
      titleId: 'mealReviewTitle',
    });
    render();
  });
}

function isDrinkReviewItem(item = {}) {
  if (item._drinkAddon === 'sugar') return false;
  if (item._drinkAddon === 'milk' || Number(item._volumeMl) > 0 || item._displayUnit === 'ml') return true;
  const text = `${item.name || ''} ${item.portion_estimate || ''}`.toLowerCase();
  return /\b(coffee|tea|latte|chai|juice|cola|soda|wine|beer|water|smoothie|drink|coke|pepsi|milk|americano|espresso|cappuccino|lemonade)\b/.test(text);
}

function normalizeEditableItems(items) {
  return items.map((item, idx) => {
    const drinkItem = isDrinkReviewItem(item);
    const lineText = `${item.name || ''} ${item.portion_estimate || ''}`;
    const countable = !drinkItem && isBreadItemText(lineText);
    const breadRef = countable
      ? (resolveBreadReference(lineText) || matchFoodReference(item.name || item.portion_estimate || ''))
      : null;
    const ref = breadRef;
    const gramsPerPiece = countable
      ? (canonicalPieceGrams(ref?.id || item._refId, lineText) || Number(item._gramsPerPiece) || 60)
      : null;
    const explicitCount = countable ? parseExplicitPieceCount(lineText) : 0;
    const pieceCount = Number(item._pieceCount) > 0 ? Number(item._pieceCount) : explicitCount;
    let grams = Number(item._hiddenGrams)
      || Number(item.grams)
      || parseGrams(item.portion_estimate)
      || Number(item._originalGrams)
      || (drinkItem ? 250 : 100);
    if (
      countable
      && pieceCount > 0
      && gramsPerPiece
      && (item._clarifyAdjusted || item._localClarify || item._userEnteredWeight || explicitCount > 0)
    ) {
      grams = Math.round(pieceCount * gramsPerPiece);
    }
    const calories = Number(item._originalCalories ?? item.calories_kcal) || 0;
    const nutrition = { ...(item._originalNutrition || item.nutrition || {}) };
    const displayUnit = item._drinkAddon === 'sugar'
      ? 'g'
      : (drinkItem ? 'ml' : (item._displayUnit || (countable ? 'piece' : 'g')));
    return {
      ...item,
      id: item.id || `item-${idx}-${Date.now()}`,
      name: item.name || 'Item',
      grams,
      baseGrams: grams,
      _originalGrams: grams,
      _originalCalories: calories,
      _originalNutrition: { ...nutrition },
      calories_kcal: calories,
      baseCalories: calories,
      nutrition: { ...nutrition },
      baseNutrition: { ...nutrition },
      portion_estimate: item.portion_estimate || (drinkItem ? `Estimated ${grams} ml` : `Estimated ${grams} g`),
      _unmatched: Boolean(item._unmatched),
      _displayUnit: displayUnit,
      _volumeMl: drinkItem ? (Number(item._volumeMl) || grams) : item._volumeMl,
      _gramsPerPiece: gramsPerPiece || item._gramsPerPiece,
      _pieceCount: pieceCount || item._pieceCount,
      ...(ref?.id ? { _refId: item._refId || ref.id } : {}),
    };
  });
}

function createManualItem(name, grams, calories, unit = 'g') {
  const protein_g = Math.round(calories * 0.05);
  const fat_g = Math.round(calories * 0.8 / 9);
  const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4));
  const nutrition = { protein_g, carbs_g, fat_g, fibre_g: null, sugar_g: null, salt_mg: null };
  return {
    id: `manual-${Date.now()}`,
    name,
    grams,
    baseGrams: grams,
    _originalGrams: grams,
    _originalCalories: calories,
    _originalNutrition: { ...nutrition },
    calories_kcal: calories,
    baseCalories: calories,
    nutrition,
    baseNutrition: { ...nutrition },
    portion_estimate: `User-entered ${Math.round(grams)} ${unit}`,
    _userEnteredWeight: true,
    _displayUnit: unit,
    _volumeMl: unit === 'ml' ? grams : undefined,
  };
}

function itemGramsFromDisplay(item, amount, unitId) {
  if (unitId === 'piece' || unitId === 'slice') {
    const per = Number(item._gramsPerPiece) || (unitId === 'slice' ? 35 : 60);
    return Math.max(1, Math.round(Number(amount) * per));
  }
  return gramsFromDisplayAmount(amount, unitId, item.baseGrams || item._originalGrams);
}

function itemDisplayFromGrams(item, grams, unitId) {
  if (unitId === 'piece' || unitId === 'slice') {
    const per = Number(item._gramsPerPiece) || (unitId === 'slice' ? 35 : 60);
    return grams / per;
  }
  return displayAmountFromGrams(grams, unitId);
}

function scaleItem(item, newGrams) {
  const factor = newGrams / (item.baseGrams || newGrams || 1);
  const nutrition = scaleNutrition(item.baseNutrition, factor);
  return {
    ...item,
    grams: newGrams,
    _originalGrams: newGrams,
    _originalCalories: item.baseCalories * factor,
    _originalNutrition: { ...nutrition },
    calories_kcal: item.baseCalories * factor,
    nutrition,
    portion_estimate: `Entered serving: ${Math.round(newGrams)} g`,
    _userEnteredWeight: true,
    _hiddenGrams: newGrams,
  };
}

function scaleNutrition(n, factor) {
  const out = {};
  for (const [k, v] of Object.entries(n || {})) {
    if (v == null || !Number.isFinite(Number(v))) out[k] = null;
    else out[k] = Number(v) * factor;
  }
  return out;
}

function addNutrition(a = {}, b = {}) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const out = {};
  for (const key of keys) {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) out[key] = null;
    else out[key] = (Number(av) || 0) + (Number(bv) || 0);
  }
  return out;
}

function toSavedItem(item) {
  return {
    ...item,
    name: item.name,
    portion_estimate: item.portion_estimate || `${Math.round(item.grams)}g`,
    calories_kcal: item.calories_kcal,
    nutrition: { ...item.nutrition },
  };
}

export function parseGrams(text) {
  if (!text) return null;
  const parsed = parseGramsFromText(text);
  if (parsed > 0) return parsed;
  const m = String(text).match(/(\d+(?:\.\d+)?)\s*g\b/i);
  return m ? Number(m[1]) : null;
}

function fmtMaybe(n) {
  if (n == null || !Number.isFinite(Number(n))) return 'unavailable';
  return `${Math.round(Number(n) * 10) / 10}g`;
}

function captureFocusToken(overlay) {
  const el = overlay.querySelector(':focus');
  if (!(el instanceof HTMLElement)) return null;
  return {
    id: el.id || '',
    weightId: el.dataset.weight || '',
    name: el.getAttribute('name') || '',
  };
}

function restoreFocusToken(overlay, token) {
  if (!token) return;
  let el = token.id ? overlay.querySelector(`#${CSS.escape(token.id)}`) : null;
  if (!el && token.weightId) el = overlay.querySelector(`[data-weight="${CSS.escape(token.weightId)}"]`);
  if (!el && token.name) el = overlay.querySelector(`[name="${CSS.escape(token.name)}"]`);
  el?.focus();
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function escapeAttr(s) {
  return String(s || '').replace(/"/g, '&quot;');
}
