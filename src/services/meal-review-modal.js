import { MEAL_TYPES, defaultMealType } from './meal-types.js';
import { getUnitPrefs, formatEnergy } from './goals.js';
import { DISCLAIMERS, disclaimerBlock } from './disclaimers.js';

/** Interactive review before saving an AI scan. */
export function openMealReviewModal(analysis, { mealType = defaultMealType(), imageDataUrl = null } = {}) {
  return new Promise((resolve) => {
    const prefs = getUnitPrefs();
    const weightUnit = prefs.weight === 'oz' ? 'oz' : 'g';
    let items = normalizeEditableItems(analysis.items || []);
    let currentMealType = mealType;
    let addName = '';
    let addGrams = 15;
    let addCalories = 120;

    const overlay = document.createElement('div');
    overlay.className = 'camera-modal meal-review-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Review and adjust meal');

    function totals() {
      return recalcTotals(items, analysis.meal_summary);
    }

    function render() {
      const t = totals();
      overlay.innerHTML = `
        <div class="camera-modal__panel meal-review-panel">
          <header class="meal-review-head">
            <p class="step-label">Review &amp; adjust</p>
            <h2 class="barcode-title">${escapeHtml(t.meal_summary || 'Your meal')}</h2>
            <p class="fine-print">Adjust weights, add hidden items (oil, butter), or remove mistakes — then confirm.</p>
          </header>
          ${imageDataUrl ? `<img src="${imageDataUrl}" alt="" class="preview-img preview-img--small meal-review-photo"/>` : ''}
          <div class="meal-review-summary">
            <span class="review-kcal">${Math.round(t.total_calories_kcal)}</span>
            <span>kcal total · P ${fmt(t.total_nutrition.protein_g)}g · C ${fmt(t.total_nutrition.carbs_g)}g · F ${fmt(t.total_nutrition.fat_g)}g</span>
          </div>
          <p class="step-label">Meal type</p>
          <div class="meal-type-row meal-review-types" id="reviewMealTypes">
            ${MEAL_TYPES.map((mt) => `
              <button type="button" class="meal-type-btn ${currentMealType === mt.id ? 'meal-type-btn--active' : ''}" data-type="${mt.id}">
                ${mt.icon} ${mt.label}
              </button>
            `).join('')}
          </div>
          <ul class="meal-review-items" id="reviewItemsList">
            ${items.map((item) => itemRow(item, weightUnit)).join('')}
          </ul>
          <details class="meal-review-add">
            <summary>Add hidden item (oil, butter, sauce…)</summary>
            <div class="meal-review-add-form">
              <label class="field full">
                <span>Name</span>
                <input type="text" id="addItemName" placeholder="e.g. Cooking oil — 1 tbsp" value="${escapeAttr(addName)}"/>
              </label>
              <div class="meal-review-add-row">
                <label class="field">
                  <span>Amount (${weightUnit})</span>
                  <input type="number" id="addItemGrams" min="1" step="1" value="${addGrams}"/>
                </label>
                <label class="field">
                  <span>Energy (kcal)</span>
                  <input type="number" id="addItemCalories" min="0" step="1" value="${addCalories}"/>
                </label>
              </div>
              <button type="button" class="btn btn-ghost btn-sm full" id="addItemBtn">Add item</button>
            </div>
          </details>
          ${disclaimerBlock(DISCLAIMERS.nutritionEstimate, 'fine-print health-disclaimer')}
          <div class="camera-modal__actions full meal-review-actions">
            <button type="button" class="btn btn-ghost" id="reviewCancel">Cancel</button>
            <button type="button" class="btn btn-primary" id="reviewConfirm">Confirm &amp; save</button>
          </div>
        </div>
      `;
      bindEvents();
    }

    function itemRow(item, unit) {
      const displayWeight = unit === 'oz' ? gramsToOz(item.grams) : item.grams;
      const step = unit === 'oz' ? 0.1 : 1;
      return `
        <li class="meal-review-item" data-id="${item.id}">
          <div class="meal-review-item-head">
            <strong>${escapeHtml(item.name)}</strong>
            <button type="button" class="btn-icon meal-review-delete" data-delete="${item.id}" aria-label="Remove ${escapeAttr(item.name)}">✕</button>
          </div>
          <div class="meal-review-item-controls">
            <label class="field meal-review-weight">
              <span>Weight (${unit})</span>
              <input type="number" min="${step}" step="${step}" value="${displayWeight}" data-weight="${item.id}"/>
            </label>
            <span class="meal-review-item-kcal">${formatEnergy(item.calories_kcal, prefs)}</span>
          </div>
        </li>
      `;
    }

    function bindEvents() {
      overlay.querySelector('#reviewCancel')?.addEventListener('click', () => close(null));
      overlay.querySelector('#reviewConfirm')?.addEventListener('click', () => {
        const t = totals();
        close({
          analysis: {
            ...analysis,
            meal_summary: t.meal_summary,
            total_calories_kcal: t.total_calories_kcal,
            total_nutrition: t.total_nutrition,
            items: items.map(toSavedItem),
          },
          mealType: currentMealType,
        });
      });

      overlay.querySelectorAll('#reviewMealTypes .meal-type-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentMealType = btn.dataset.type;
          render();
        });
      });

      overlay.querySelectorAll('[data-weight]').forEach((input) => {
        input.addEventListener('change', () => {
          const id = input.dataset.weight;
          const item = items.find((i) => i.id === id);
          if (!item) return;
          let grams = Number(input.value);
          if (weightUnit === 'oz') grams = ozToGrams(grams);
          if (!grams || grams < 1) grams = item.baseGrams;
          items = items.map((i) => (i.id === id ? scaleItem(i, grams) : i));
          render();
        });
      });

      overlay.querySelectorAll('[data-delete]').forEach((btn) => {
        btn.addEventListener('click', () => {
          items = items.filter((i) => i.id !== btn.dataset.delete);
          render();
        });
      });

      overlay.querySelector('#addItemBtn')?.addEventListener('click', () => {
        addName = overlay.querySelector('#addItemName')?.value.trim() || '';
        addGrams = Number(overlay.querySelector('#addItemGrams')?.value) || 15;
        addCalories = Number(overlay.querySelector('#addItemCalories')?.value) || 0;
        if (!addName) return;
        let grams = addGrams;
        if (weightUnit === 'oz') grams = ozToGrams(addGrams);
        items.push(createManualItem(addName, grams, addCalories));
        addName = '';
        render();
      });
    }

    function close(result) {
      overlay.remove();
      document.body.style.overflow = '';
      resolve(result);
    }

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    render();
  });
}

function normalizeEditableItems(items) {
  return items.map((item, idx) => {
    const grams = parseGrams(item.portion_estimate) || 100;
    const calories = Number(item.calories_kcal) || 0;
    const nutrition = { ...(item.nutrition || {}) };
    return {
      id: `item-${idx}-${Date.now()}`,
      name: item.name || 'Item',
      grams,
      baseGrams: grams,
      calories_kcal: calories,
      baseCalories: calories,
      nutrition: { ...nutrition },
      baseNutrition: { ...nutrition },
      portion_estimate: item.portion_estimate || `${grams}g`,
    };
  });
}

function createManualItem(name, grams, calories) {
  const protein_g = Math.round(calories * 0.05);
  const fat_g = Math.round(calories * 0.8 / 9);
  const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4));
  const nutrition = { protein_g, carbs_g, fat_g, fibre_g: 0, sugar_g: 0, salt_mg: 0 };
  return {
    id: `manual-${Date.now()}`,
    name,
    grams,
    baseGrams: grams,
    calories_kcal: calories,
    baseCalories: calories,
    nutrition,
    baseNutrition: { ...nutrition },
    portion_estimate: `${Math.round(grams)}g`,
  };
}

function scaleItem(item, newGrams) {
  const factor = newGrams / item.baseGrams;
  return {
    ...item,
    grams: newGrams,
    calories_kcal: Math.round(item.baseCalories * factor),
    nutrition: scaleNutrition(item.baseNutrition, factor),
    portion_estimate: `${Math.round(newGrams)}g`,
  };
}

function scaleNutrition(n, factor) {
  const out = {};
  for (const [k, v] of Object.entries(n || {})) {
    out[k] = Math.round((Number(v) || 0) * factor * 10) / 10;
  }
  return out;
}

function recalcTotals(items, mealSummary) {
  let total_calories_kcal = 0;
  const total_nutrition = { protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0, sugar_g: 0, salt_mg: 0 };
  for (const item of items) {
    total_calories_kcal += item.calories_kcal || 0;
    for (const key of Object.keys(total_nutrition)) {
      total_nutrition[key] += Number(item.nutrition?.[key]) || 0;
    }
  }
  for (const key of Object.keys(total_nutrition)) {
    total_nutrition[key] = Math.round(total_nutrition[key] * 10) / 10;
  }
  return {
    meal_summary: mealSummary,
    total_calories_kcal: Math.round(total_calories_kcal),
    total_nutrition,
  };
}

function toSavedItem(item) {
  return {
    name: item.name,
    portion_estimate: item.portion_estimate || `${Math.round(item.grams)}g`,
    calories_kcal: Math.round(item.calories_kcal),
    nutrition: { ...item.nutrition },
    confidence: 0.9,
  };
}

export function parseGrams(text) {
  if (!text) return null;
  const m = String(text).match(/(\d+(?:\.\d+)?)\s*g\b/i);
  return m ? Number(m[1]) : null;
}

function gramsToOz(g) {
  return Math.round((g / 28.3495) * 10) / 10;
}

function ozToGrams(oz) {
  return Math.round(oz * 28.3495);
}

function fmt(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function escapeAttr(s) {
  return String(s || '').replace(/"/g, '&quot;');
}
