import { saveMeal } from './storage.js';
import { MEAL_TYPES, defaultMealType } from './meal-types.js';
import { getUnitPrefs } from './goals.js';
import { DISCLAIMERS } from './disclaimers.js';
import { openMealReviewModal } from './meal-review-modal.js';
import { bindModalA11y } from './modal-a11y.js';

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Edit an existing saved meal: foods/portions or manual totals. */
export function openMealEditorModal(meal, { title = 'Edit meal' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'camera-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'mealEditorTitle');
    let cleanup = null;
    let mode = meal.items?.length ? 'choose' : 'totals';

    function close(result) {
      cleanup?.();
      overlay.remove();
      document.body.style.overflow = '';
      resolve(result);
    }

    function render() {
      if (mode === 'choose') {
        overlay.innerHTML = `
          <div class="camera-modal__panel meal-editor-panel">
            <h2 class="barcode-title" id="mealEditorTitle">${escapeHtml(title)}</h2>
            <p class="fine-print">Choose how you want to correct this meal.</p>
            <button type="button" class="btn btn-primary full" id="editPortions">Edit foods and portions</button>
            <button type="button" class="btn btn-ghost full" id="editTotals">Edit total values manually</button>
            ${meal._originalEstimate ? `<button type="button" class="btn btn-ghost full" id="restoreOriginal">Restore original estimate</button>` : ''}
            <div class="camera-modal__actions full">
              <button type="button" class="btn btn-ghost" id="mealEditorCancel">Cancel</button>
            </div>
          </div>
        `;
        overlay.querySelector('#editPortions')?.addEventListener('click', async () => {
          const result = await openMealReviewModal({
            meal_summary: meal.meal_summary,
            total_calories_kcal: meal.total_calories_kcal,
            total_nutrition: meal.total_nutrition,
            items: meal.items || [],
            source: meal.source,
            _confidence: meal._confidence,
            confidence_score: meal.confidence_score,
          }, {
            mealType: meal.meal_type || defaultMealType(),
            imageDataUrl: meal.photoDataUrl || null,
          });
          if (!result) return;
          const updated = {
            ...meal,
            ...result.analysis,
            meal_type: result.mealType,
            total_calories_kcal: Math.round(result.analysis.total_calories_kcal),
            _manuallyAdjusted: false,
          };
          try {
            await saveMeal(updated);
            close(updated);
          } catch (err) {
            alert(err.message || 'Could not save');
          }
        });
        overlay.querySelector('#editTotals')?.addEventListener('click', () => {
          mode = 'totals';
          render();
        });
        overlay.querySelector('#restoreOriginal')?.addEventListener('click', async () => {
          const orig = meal._originalEstimate;
          const updated = {
            ...meal,
            total_calories_kcal: Math.round(orig.total_calories_kcal),
            total_nutrition: orig.total_nutrition,
            items: orig.items,
            _manuallyAdjusted: false,
          };
          try {
            await saveMeal(updated);
            close(updated);
          } catch (err) {
            alert(err.message || 'Could not save');
          }
        });
        overlay.querySelector('#mealEditorCancel')?.addEventListener('click', () => close(null));
        return;
      }

      const n = meal.total_nutrition || {};
      const prefs = getUnitPrefs();
      const energyFieldNote = prefs.energy === 'kJ'
        ? 'Enter kcal — the app shows kJ on Today and Reports'
        : '';
      overlay.innerHTML = `
        <div class="camera-modal__panel meal-editor-panel">
          <h2 class="barcode-title" id="mealEditorTitle">${escapeHtml(title)}</h2>
          ${meal._manuallyAdjusted ? '<p class="warn-text">Manually adjusted</p>' : ''}
          <form id="mealEditorForm" class="auth-form meal-editor-form">
            <label class="field full">
              <span>Name</span>
              <input type="text" name="meal_summary" value="${escapeAttr(meal.meal_summary || '')}" required/>
            </label>
            <label class="field full">
              <span>Meal hints (optional)</span>
              <textarea name="meal_notes" rows="2" placeholder="Notes about ingredients, portion, cooking…">${escapeHtml(meal.meal_notes || '')}</textarea>
            </label>
            <label class="field full">
              <span>Meal type</span>
              <select name="meal_type">
                ${MEAL_TYPES.map((t) => `<option value="${t.id}" ${meal.meal_type === t.id ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}
              </select>
            </label>
            <label class="field">
              <span>Energy (kcal)${energyFieldNote ? ` — ${energyFieldNote}` : ''}</span>
              <input type="number" name="calories" min="0" step="1" value="${Math.round(meal.total_calories_kcal || 0)}"/>
            </label>
            <label class="field">
              <span>Protein (g)</span>
              <input type="number" name="protein_g" min="0" step="0.1" value="${n.protein_g ?? ''}"/>
            </label>
            <label class="field">
              <span>Carbs (g)</span>
              <input type="number" name="carbs_g" min="0" step="0.1" value="${n.carbs_g ?? ''}"/>
            </label>
            <label class="field">
              <span>Fat (g)</span>
              <input type="number" name="fat_g" min="0" step="0.1" value="${n.fat_g ?? ''}"/>
            </label>
            <label class="field">
              <span>Fibre (g)</span>
              <input type="number" name="fibre_g" min="0" step="0.1" value="${n.fibre_g ?? ''}"/>
            </label>
            <label class="field">
              <span>Sugar (g)</span>
              <input type="number" name="sugar_g" min="0" step="0.1" value="${n.sugar_g ?? ''}"/>
            </label>
            <label class="field">
              <span>Salt (mg)</span>
              <input type="number" name="salt_mg" min="0" step="1" value="${n.salt_mg ?? ''}"/>
            </label>
            <p class="fine-print health-disclaimer" id="macroWarn" hidden>Calories and macros do not match. You can still save this intentional correction.</p>
            <p class="fine-print health-disclaimer">${DISCLAIMERS.nutritionEstimate}</p>
            <div class="camera-modal__actions full">
              <button type="button" class="btn btn-ghost" id="mealEditorCancel">Cancel</button>
              <button type="submit" class="btn btn-primary">Save changes</button>
            </div>
          </form>
        </div>
      `;
      overlay.querySelector('#mealEditorCancel').addEventListener('click', () => close(null));
      overlay.querySelector('#mealEditorForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const total_nutrition = {
          protein_g: numOrNull(fd.get('protein_g')),
          carbs_g: numOrNull(fd.get('carbs_g')),
          fat_g: numOrNull(fd.get('fat_g')),
          fibre_g: numOrNull(fd.get('fibre_g')),
          sugar_g: numOrNull(fd.get('sugar_g')),
          salt_mg: numOrNull(fd.get('salt_mg')),
        };
        const calories = Number(fd.get('calories')) || 0;
        const implied = (Number(total_nutrition.protein_g) || 0) * 4
          + (Number(total_nutrition.carbs_g) || 0) * 4
          + (Number(total_nutrition.fat_g) || 0) * 9;
        if (implied > 0 && Math.abs(implied - calories) > 40) {
          overlay.querySelector('#macroWarn').hidden = false;
        }
        const updated = {
          ...meal,
          meal_summary: String(fd.get('meal_summary') || '').trim(),
          meal_notes: String(fd.get('meal_notes') || '').trim(),
          meal_type: fd.get('meal_type') || defaultMealType(),
          total_calories_kcal: calories,
          total_nutrition,
          _manuallyAdjusted: true,
          _originalEstimate: meal._originalEstimate || {
            total_calories_kcal: meal.total_calories_kcal,
            total_nutrition: meal.total_nutrition,
            items: meal.items,
          },
        };
        try {
          await saveMeal(updated);
          close(updated);
        } catch (err) {
          alert(err.message || 'Could not save');
        }
      });
    }

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    cleanup = bindModalA11y(overlay, { onClose: () => close(null), titleId: 'mealEditorTitle' });
    render();
  });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function escapeAttr(s) {
  return String(s || '').replace(/"/g, '&quot;');
}
