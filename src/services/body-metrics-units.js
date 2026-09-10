/** Height/weight unit options and conversions for onboarding + settings wizard. */

export const HEIGHT_UNITS = [
  { id: 'cm', label: 'cm' },
  { id: 'ft_in', label: 'ft/in' },
];

export const WEIGHT_UNITS = [
  { id: 'kg', label: 'kg' },
  { id: 'lbs', label: 'lb' },
  { id: 'st_lb', label: 'st/lb' },
];

const MIN_HEIGHT_CM = 120;
const MAX_HEIGHT_CM = 230;
const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 300;

export function normalizeHeightUnit(unit = 'cm') {
  if (unit === 'ft') return 'ft_in';
  return HEIGHT_UNITS.some((u) => u.id === unit) ? unit : 'cm';
}

export function normalizeWeightUnit(unit = 'kg') {
  return WEIGHT_UNITS.some((u) => u.id === unit) ? unit : 'kg';
}

export function emptyBodyMetricState(saved = {}) {
  return {
    heightUnit: normalizeHeightUnit(saved.heightUnit),
    heightCm: saved.heightCm ?? '',
    heightFt: saved.heightFt ?? '',
    heightIn: saved.heightIn ?? '',
    weightUnit: normalizeWeightUnit(saved.weightUnit),
    weightKg: saved.weightKg ?? '',
    weightLbs: saved.weightLbs ?? '',
    weightSt: saved.weightSt ?? '',
    weightStLb: saved.weightStLb ?? '',
  };
}

function lbsToKg(lbs) {
  return Math.round((lbs / 2.2046226218) * 10) / 10;
}

function stoneToLbs(st, lb = 0) {
  return Number(st) * 14 + Number(lb || 0);
}

export function parseHeightCm(state = {}) {
  if (normalizeHeightUnit(state.heightUnit) === 'cm') {
    const cm = Number(state.heightCm);
    return cm || null;
  }
  const ft = Number(state.heightFt);
  const inches = Number(state.heightIn) || 0;
  if (!ft && !inches) return null;
  return Math.round((ft * 12 + inches) * 2.54);
}

export function parseWeightKg(state = {}) {
  const unit = normalizeWeightUnit(state.weightUnit);
  if (unit === 'lbs') {
    const lbs = Number(state.weightLbs);
    return lbs ? lbsToKg(lbs) : null;
  }
  if (unit === 'st_lb') {
    const st = Number(state.weightSt);
    const stLb = Number(state.weightStLb) || 0;
    if (!st && !stLb) return null;
    return lbsToKg(stoneToLbs(st, stLb));
  }
  const kg = Number(state.weightKg);
  return kg || null;
}

export function validateBodyMetricInputs(state = {}, { strict = true, allowDefaults = false } = {}) {
  const sex = state.sex === 'male' ? 'male' : 'female';
  const ageRaw = Number(state.age);
  const parsedHeight = parseHeightCm(state);
  const parsedWeight = parseWeightKg(state);

  if (strict && !allowDefaults) {
    if (!ageRaw || ageRaw < 16 || ageRaw > 100) {
      throw new Error('Enter your age (16–100)');
    }
    if (!parsedHeight) {
      throw new Error('Enter your height');
    }
    if (parsedHeight < MIN_HEIGHT_CM || parsedHeight > MAX_HEIGHT_CM) {
      throw new Error('Enter a valid height (about 120–230 cm / 4–7 ft)');
    }
    if (!parsedWeight) {
      throw new Error('Enter your weight');
    }
    if (parsedWeight < MIN_WEIGHT_KG || parsedWeight > MAX_WEIGHT_KG) {
      throw new Error('Enter a valid weight (about 30–300 kg)');
    }
  }

  const age = ageRaw >= 16 && ageRaw <= 100 ? ageRaw : 35;
  let heightCm = parsedHeight;
  let weightKg = parsedWeight;
  const usedDefaults = { height: !heightCm, weight: !weightKg, age: !ageRaw };

  if (!heightCm && allowDefaults) heightCm = sex === 'male' ? 175 : 163;
  if (!weightKg && allowDefaults) weightKg = 70;

  if (strict && allowDefaults) {
    if (ageRaw && (ageRaw < 16 || ageRaw > 100)) {
      throw new Error('Enter a valid age (16–100)');
    }
    if (Number(state.heightCm) && (heightCm < MIN_HEIGHT_CM || heightCm > MAX_HEIGHT_CM)) {
      throw new Error('Enter a valid height in cm (120–230)');
    }
    if (normalizeWeightUnit(state.weightUnit) === 'kg' && Number(state.weightKg) && (weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG)) {
      throw new Error('Enter a valid weight in kg (30–300)');
    }
    if (normalizeWeightUnit(state.weightUnit) === 'lbs' && Number(state.weightLbs) && (weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG)) {
      throw new Error('Enter a valid weight in lb (66–660)');
    }
    if (normalizeWeightUnit(state.weightUnit) === 'st_lb' && (Number(state.weightSt) || Number(state.weightStLb)) && (weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG)) {
      throw new Error('Enter a valid weight in stone/lb');
    }
    if (normalizeWeightUnit(state.weightUnit) === 'st_lb') {
      const stLb = Number(state.weightStLb);
      if (Number.isFinite(stLb) && state.weightStLb !== '' && (stLb < 0 || stLb > 13)) {
        throw new Error('Pounds within stone must be 0–13 (e.g. 11 st 4 lb)');
      }
    }
    if (normalizeHeightUnit(state.heightUnit) === 'ft_in') {
      const inches = Number(state.heightIn);
      if (Number.isFinite(inches) && state.heightIn !== '' && (inches < 0 || inches > 11)) {
        throw new Error('Inches must be 0–11');
      }
    }
  }

  if (strict && !allowDefaults && (!heightCm || !weightKg)) {
    throw new Error('Enter your height and weight for accurate targets');
  }

  return { weightKg, heightCm, age, usedDefaults };
}

function fieldAttr(name, prefix) {
  if (!prefix) return `name="${name}"`;
  const id = `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  return `id="${id}" name="${id}"`;
}

export function unitToggleHtml(units, activeId, dataAttrName) {
  return `
    <div class="segmented segmented--units" role="group" aria-label="Unit">
      ${units.map((u) => `
        <button type="button" class="segmented-btn ${activeId === u.id ? 'active' : ''}" ${dataAttrName}="${u.id}">${u.label}</button>
      `).join('')}
    </div>
  `;
}

export function heightFieldsHtml(state, escapeAttr = String, { prefix = '' } = {}) {
  if (normalizeHeightUnit(state.heightUnit) === 'cm') {
    return `
      <label class="field full">
        <span>Height (cm)</span>
        <input type="number" ${fieldAttr('heightCm', prefix)} min="120" max="230" inputmode="decimal" placeholder="e.g. 170" value="${escapeAttr(state.heightCm)}" required/>
      </label>
    `;
  }
  return `
    <div class="onboarding-split">
      <label class="field">
        <span>Feet</span>
        <input type="number" ${fieldAttr('heightFt', prefix)} min="4" max="7" inputmode="numeric" placeholder="e.g. 5" value="${escapeAttr(state.heightFt)}" required/>
      </label>
      <label class="field">
        <span>Inches</span>
        <input type="number" ${fieldAttr('heightIn', prefix)} min="0" max="11" inputmode="numeric" placeholder="e.g. 7" value="${escapeAttr(state.heightIn)}" required/>
      </label>
    </div>
  `;
}

export function weightFieldsHtml(state, escapeAttr = String, { prefix = '' } = {}) {
  const unit = normalizeWeightUnit(state.weightUnit);
  if (unit === 'kg') {
    return `
      <label class="field full">
        <span>Weight (kg)</span>
        <input type="number" ${fieldAttr('weightKg', prefix)} min="30" max="300" step="0.1" inputmode="decimal" placeholder="e.g. 72" value="${escapeAttr(state.weightKg)}" required/>
      </label>
    `;
  }
  if (unit === 'lbs') {
    return `
      <label class="field full">
        <span>Weight (lb)</span>
        <input type="number" ${fieldAttr('weightLbs', prefix)} min="66" max="660" step="0.1" inputmode="decimal" placeholder="e.g. 160" value="${escapeAttr(state.weightLbs)}" required/>
      </label>
    `;
  }
  return `
    <div class="onboarding-split">
      <label class="field">
        <span>Stone</span>
        <input type="number" ${fieldAttr('weightSt', prefix)} min="4" max="30" inputmode="numeric" placeholder="e.g. 11" value="${escapeAttr(state.weightSt)}" required/>
      </label>
      <label class="field">
        <span>Pounds</span>
        <input type="number" ${fieldAttr('weightStLb', prefix)} min="0" max="13" inputmode="numeric" placeholder="e.g. 4" value="${escapeAttr(state.weightStLb)}"/>
      </label>
    </div>
    <p class="fine-print onboarding-unit-hint">UK stone format — e.g. 11 st 4 lb</p>
  `;
}

export function bodyMetricsStepHtml(state, escapeAttr = String) {
  return `
    <div class="onboarding-unit-toggle">
      <span>Height</span>
      ${unitToggleHtml(HEIGHT_UNITS, normalizeHeightUnit(state.heightUnit), 'data-height-unit')}
    </div>
    ${heightFieldsHtml(state, escapeAttr)}
    <div class="onboarding-unit-toggle">
      <span>Weight</span>
      ${unitToggleHtml(WEIGHT_UNITS, normalizeWeightUnit(state.weightUnit), 'data-weight-unit')}
    </div>
    ${weightFieldsHtml(state, escapeAttr)}
  `;
}

export function readBodyMetricsFromForm(form, state) {
  if (!form) return state;
  const fd = new FormData(form);
  const next = { ...state };
  if (fd.get('sex')) next.sex = fd.get('sex');
  if (fd.has('age')) next.age = fd.get('age');

  if (normalizeHeightUnit(next.heightUnit) === 'cm') {
    next.heightCm = fd.get('heightCm');
  } else {
    next.heightFt = fd.get('heightFt');
    next.heightIn = fd.get('heightIn');
  }

  const unit = normalizeWeightUnit(next.weightUnit);
  if (unit === 'kg') next.weightKg = fd.get('weightKg');
  else if (unit === 'lbs') next.weightLbs = fd.get('weightLbs');
  else {
    next.weightSt = fd.get('weightSt');
    next.weightStLb = fd.get('weightStLb');
  }
  return next;
}

export function settingsBodyMetricsHtml(state) {
  const s = emptyBodyMetricState(state);
  return `
    <div class="wizard-body-block full">
      <span class="wizard-body-block__label">Height</span>
      ${unitToggleHtml(HEIGHT_UNITS, s.heightUnit, 'data-wiz-height-unit')}
      <div id="wizHeightFields">${heightFieldsHtml(s, String, { prefix: 'wiz' })}</div>
    </div>
    <div class="wizard-body-block full">
      <span class="wizard-body-block__label">Weight</span>
      ${unitToggleHtml(WEIGHT_UNITS, s.weightUnit, 'data-wiz-weight-unit')}
      <div id="wizWeightFields">${weightFieldsHtml(s, String, { prefix: 'wiz' })}</div>
    </div>
  `;
}

export function readSettingsWizardBody(root, base = {}) {
  const state = emptyBodyMetricState(base);
  const activeHeight = root.querySelector('[data-wiz-height-unit].active')?.dataset.wizHeightUnit;
  const activeWeight = root.querySelector('[data-wiz-weight-unit].active')?.dataset.wizWeightUnit;
  if (activeHeight) state.heightUnit = activeHeight;
  if (activeWeight) state.weightUnit = activeWeight;

  if (normalizeHeightUnit(state.heightUnit) === 'cm') {
    state.heightCm = root.querySelector('#wizHeightCm')?.value ?? state.heightCm;
  } else {
    state.heightFt = root.querySelector('#wizHeightFt')?.value ?? state.heightFt;
    state.heightIn = root.querySelector('#wizHeightIn')?.value ?? state.heightIn;
  }

  const unit = normalizeWeightUnit(state.weightUnit);
  if (unit === 'kg') state.weightKg = root.querySelector('#wizWeightKg')?.value ?? state.weightKg;
  else if (unit === 'lbs') state.weightLbs = root.querySelector('#wizWeightLbs')?.value ?? state.weightLbs;
  else {
    state.weightSt = root.querySelector('#wizWeightSt')?.value ?? state.weightSt;
    state.weightStLb = root.querySelector('#wizWeightStLb')?.value ?? state.weightStLb;
  }
  return state;
}

export function renderSettingsBodyFieldGroups(root, state) {
  const s = emptyBodyMetricState(state);
  const heightWrap = root.querySelector('#wizHeightFields');
  const weightWrap = root.querySelector('#wizWeightFields');
  if (heightWrap) heightWrap.innerHTML = heightFieldsHtml(s, String, { prefix: 'wiz' });
  if (weightWrap) weightWrap.innerHTML = weightFieldsHtml(s, String, { prefix: 'wiz' });
}

export function syncSettingsUnitButtons(root, state) {
  root.querySelectorAll('[data-wiz-height-unit]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.wizHeightUnit === normalizeHeightUnit(state.heightUnit));
  });
  root.querySelectorAll('[data-wiz-weight-unit]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.wizWeightUnit === normalizeWeightUnit(state.weightUnit));
  });
}
