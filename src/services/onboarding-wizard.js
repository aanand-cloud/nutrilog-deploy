import { saveGoals, DEFAULT_GOALS, hasCompletedOnboarding, markOnboardingComplete, isDefaultGoals, getGoals } from './goals.js';
import { estimateDailyCalories, suggestMacros } from './calorie-wizard.js';

const PROFILE_KEY = 'nutrilog_wizard_profile';

const GOAL_OPTIONS = [
  { id: 'lose', label: 'Weight loss', detail: 'About −0.5 kg / week' },
  { id: 'maintain', label: 'Maintenance', detail: 'Stay at current weight' },
  { id: 'gain', label: 'Weight gain', detail: 'About +0.25 kg / week' },
];

const ACTIVITY_OPTIONS = [
  { id: 'sedentary', label: 'Sedentary', detail: 'Desk job, little exercise' },
  { id: 'moderate', label: 'Moderately active', detail: 'Exercise 3–5 days / week' },
  { id: 'active', label: 'Very active', detail: 'Hard exercise or physical job' },
];

export function shouldShowOnboarding() {
  if (hasCompletedOnboarding()) return false;
  return isDefaultGoals(getGoals());
}

export function getWizardProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveWizardProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/** 3-step TDEE onboarding for new users. */
export function openOnboardingWizard({ onComplete } = {}) {
  return new Promise((resolve) => {
    const saved = getWizardProfile() || {};
    let step = 1;
    const state = {
      sex: saved.sex || 'female',
      age: saved.age || '',
      heightUnit: saved.heightUnit || 'cm',
      heightCm: saved.heightCm || '',
      heightFt: saved.heightFt || '',
      heightIn: saved.heightIn || '',
      weightUnit: saved.weightUnit || 'kg',
      weightKg: saved.weightKg || '',
      weightLbs: saved.weightLbs || '',
      weightGoal: saved.weightGoal || 'maintain',
      activity: saved.activity || 'moderate',
    };

    const overlay = document.createElement('div');
    overlay.className = 'camera-modal onboarding-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    function close(result) {
      overlay.remove();
      document.body.style.overflow = '';
      resolve(result);
      if (result?.goals) onComplete?.(result.goals);
    }

    function render() {
      overlay.innerHTML = `
        <div class="camera-modal__panel onboarding-panel">
          <div class="onboarding-progress" aria-hidden="true">
            ${[1, 2, 3].map((n) => `<span class="onboarding-dot ${step >= n ? 'onboarding-dot--active' : ''}"></span>`).join('')}
          </div>
          ${step === 1 ? stepBody() : step === 2 ? stepGoal() : stepActivity()}
          <div class="camera-modal__actions full onboarding-actions">
            ${step > 1 ? `<button type="button" class="btn btn-ghost" id="onboardBack">Back</button>` : '<span></span>'}
            <button type="button" class="btn btn-primary" id="onboardNext">${step === 3 ? 'Save my targets' : 'Continue'}</button>
          </div>
        </div>
      `;
      bindStep();
    }

    function stepBody() {
      return `
        <h2 class="barcode-title">Let's set your daily targets</h2>
        <p class="fine-print onboarding-lead">Step 1 of 3 — we'll estimate calories and macros from your body stats.</p>
        <form class="auth-form onboarding-form" id="onboardForm1">
          <label class="field full">
            <span>Gender</span>
            <select name="sex">
              <option value="female" ${state.sex === 'female' ? 'selected' : ''}>Female</option>
              <option value="male" ${state.sex === 'male' ? 'selected' : ''}>Male</option>
            </select>
          </label>
          <label class="field full">
            <span>Age</span>
            <input type="number" name="age" min="16" max="100" inputmode="numeric" placeholder="e.g. 34" value="${escapeAttr(state.age)}"/>
          </label>
          <div class="onboarding-unit-toggle">
            <span>Height</span>
            <div class="segmented" role="group">
              <button type="button" class="segmented-btn ${state.heightUnit === 'cm' ? 'active' : ''}" data-height-unit="cm">cm</button>
              <button type="button" class="segmented-btn ${state.heightUnit === 'ft' ? 'active' : ''}" data-height-unit="ft">ft/in</button>
            </div>
          </div>
          ${state.heightUnit === 'cm' ? `
            <label class="field full">
              <span>Height (cm)</span>
              <input type="number" name="heightCm" min="120" max="230" inputmode="decimal" placeholder="e.g. 170" value="${escapeAttr(state.heightCm)}"/>
            </label>
          ` : `
            <div class="onboarding-split">
              <label class="field">
                <span>Feet</span>
                <input type="number" name="heightFt" min="4" max="7" value="${escapeAttr(state.heightFt)}"/>
              </label>
              <label class="field">
                <span>Inches</span>
                <input type="number" name="heightIn" min="0" max="11" value="${escapeAttr(state.heightIn)}"/>
              </label>
            </div>
          `}
          <div class="onboarding-unit-toggle">
            <span>Weight</span>
            <div class="segmented" role="group">
              <button type="button" class="segmented-btn ${state.weightUnit === 'kg' ? 'active' : ''}" data-weight-unit="kg">kg</button>
              <button type="button" class="segmented-btn ${state.weightUnit === 'lbs' ? 'active' : ''}" data-weight-unit="lbs">lbs</button>
            </div>
          </div>
          <label class="field full">
            <span>Weight (${state.weightUnit})</span>
            <input type="number" name="weight" min="1" step="0.1" inputmode="decimal" placeholder="${state.weightUnit === 'kg' ? 'e.g. 72' : 'e.g. 160'}" value="${escapeAttr(state.weightUnit === 'kg' ? state.weightKg : state.weightLbs)}"/>
          </label>
        </form>
      `;
    }

    function stepGoal() {
      return `
        <h2 class="barcode-title">What's your goal?</h2>
        <p class="fine-print onboarding-lead">Step 2 of 3 — we'll adjust calories from your maintenance level.</p>
        <div class="onboarding-options" id="goalOptions">
          ${GOAL_OPTIONS.map((g) => `
            <button type="button" class="onboarding-option ${state.weightGoal === g.id ? 'onboarding-option--active' : ''}" data-goal="${g.id}">
              <strong>${g.label}</strong>
              <span>${g.detail}</span>
            </button>
          `).join('')}
        </div>
      `;
    }

    function stepActivity() {
      const preview = buildPreview();
      return `
        <h2 class="barcode-title">How active are you?</h2>
        <p class="fine-print onboarding-lead">Step 3 of 3 — activity level sets your daily energy needs.</p>
        <div class="onboarding-options" id="activityOptions">
          ${ACTIVITY_OPTIONS.map((a) => `
            <button type="button" class="onboarding-option ${state.activity === a.id ? 'onboarding-option--active' : ''}" data-activity="${a.id}">
              <strong>${a.label}</strong>
              <span>${a.detail}</span>
            </button>
          `).join('')}
        </div>
        ${preview ? `
          <div class="onboarding-preview">
            <p><strong>Your estimated targets</strong></p>
            <p>${preview.calories_kcal} kcal/day · P ${preview.protein_g}g · C ${preview.carbs_g}g · F ${preview.fat_g}g</p>
            <p class="fine-print">Maintenance ~${preview.tdee} kcal — wellness estimate, not medical advice.</p>
          </div>
        ` : ''}
      `;
    }

    function bindStep() {
      overlay.querySelector('#onboardBack')?.addEventListener('click', () => {
        step -= 1;
        render();
      });

      overlay.querySelector('#onboardNext')?.addEventListener('click', () => {
        if (step === 1 && !readStep1()) return;
        if (step < 3) {
          step += 1;
          render();
          return;
        }
        finish();
      });

      overlay.querySelectorAll('[data-height-unit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          readStep1(false);
          state.heightUnit = btn.dataset.heightUnit;
          render();
        });
      });
      overlay.querySelectorAll('[data-weight-unit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          readStep1(false);
          state.weightUnit = btn.dataset.weightUnit;
          render();
        });
      });

      overlay.querySelectorAll('[data-goal]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.weightGoal = btn.dataset.goal;
          render();
        });
      });

      overlay.querySelectorAll('[data-activity]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.activity = btn.dataset.activity;
          render();
        });
      });
    }

    function readStep1(showError = true) {
      const form = overlay.querySelector('#onboardForm1');
      if (!form) return true;
      const fd = new FormData(form);
      state.sex = fd.get('sex') || 'female';
      state.age = fd.get('age');
      if (state.heightUnit === 'cm') {
        state.heightCm = fd.get('heightCm');
      } else {
        state.heightFt = fd.get('heightFt');
        state.heightIn = fd.get('heightIn');
      }
      const w = fd.get('weight');
      if (state.weightUnit === 'kg') state.weightKg = w;
      else state.weightLbs = w;

      try {
        resolveBodyMetrics(state);
        saveWizardProfile(state);
        return true;
      } catch (err) {
        if (showError) alert(err.message || 'Check your inputs');
        return false;
      }
    }

    function buildPreview() {
      try {
        const { weightKg, heightCm } = resolveBodyMetrics(state);
        const estimate = estimateDailyCalories({
          sex: state.sex,
          age: state.age,
          weightKg,
          heightCm,
          activity: state.activity,
          weightGoal: state.weightGoal,
        });
        const macros = suggestMacros(estimate.target, weightKg);
        return { ...macros, calories_kcal: estimate.target, tdee: estimate.tdee };
      } catch {
        return null;
      }
    }

    async function finish() {
      try {
        const { weightKg, heightCm } = resolveBodyMetrics(state);
        const estimate = estimateDailyCalories({
          sex: state.sex,
          age: state.age,
          weightKg,
          heightCm,
          activity: state.activity,
          weightGoal: state.weightGoal,
        });
        const macros = suggestMacros(estimate.target, weightKg);
        const goals = {
          ...DEFAULT_GOALS,
          calories_kcal: estimate.target,
          protein_g: macros.protein_g,
          carbs_g: macros.carbs_g,
          fat_g: macros.fat_g,
        };
        saveGoals(goals);
        saveWizardProfile({ ...state, weightKg, heightCm });
        markOnboardingComplete();
        try {
          const { syncGoalsToCloud } = await import('./sync.js');
          await syncGoalsToCloud();
        } catch (_) {}
        close({ goals, estimate });
      } catch (err) {
        alert(err.message || 'Could not calculate targets');
      }
    }

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    render();
  });
}

export function resolveBodyMetrics(state) {
  const age = Number(state.age);
  let heightCm = Number(state.heightCm);
  if (state.heightUnit === 'ft') {
    const ft = Number(state.heightFt);
    const inches = Number(state.heightIn) || 0;
    heightCm = Math.round((ft * 12 + inches) * 2.54);
  }
  let weightKg = Number(state.weightKg);
  if (state.weightUnit === 'lbs') {
    weightKg = Math.round((Number(state.weightLbs) / 2.20462) * 10) / 10;
  }
  if (!age || !heightCm || !weightKg) {
    throw new Error('Enter your age, height, and weight');
  }
  return { weightKg, heightCm, age };
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}
