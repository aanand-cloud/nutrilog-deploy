import { computeAdaptiveTdee } from '../../shared/adaptive-tdee.js';
import { addWeighIn, latestWeighIn, listWeighIns } from '../services/weigh-ins.js';
import {
  applyHealthImport,
  collectHealthBundle,
  detectHealthBridge,
  downloadHealthBundle,
  getActiveEnergyForDate,
  healthSyncStatus,
  parseHealthImport,
  setActiveEnergyForDate,
  tryNativeHealthSync,
} from '../services/health-sync.js';
import { todayKey } from '../services/storage.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tdeeReasonCopy(tdee) {
  if (tdee.ok) return '';
  if (tdee.reason === 'need_intake_days') {
    return `Log meals on at least 7 of the last 14 days (${tdee.intakeDays || 0} so far).`;
  }
  if (tdee.reason === 'need_weigh_ins') {
    return 'Add at least two scale weigh-ins in the last 14 days.';
  }
  if (tdee.reason === 'need_weight_span') {
    return 'Space weigh-ins at least 7 days apart.';
  }
  return 'Log meals and scale weight to unlock a 14-day rolling TDEE.';
}

export function phase3SettingsModel({ meals = [], dateKey = todayKey(), wizardTdee = null } = {}) {
  const weighIns = listWeighIns();
  return {
    dateKey,
    wizardTdee,
    lastWeighIn: latestWeighIn(),
    todayEnergyKcal: getActiveEnergyForDate(dateKey),
    health: healthSyncStatus(detectHealthBridge()),
    tdee: computeAdaptiveTdee({ meals, weighIns, asOf: dateKey }),
  };
}

export function phase3RetentionHtml({
  tdee,
  wizardTdee = null,
  lastWeighIn = null,
  todayEnergyKcal = 0,
  health = { label: 'File export / import', detail: '' },
  dateKey = todayKey(),
} = {}) {
  const tdeeLine = tdee?.ok
    ? `${tdee.tdee} kcal/day · ${tdee.confidence} confidence · ${tdee.intakeDays} intake days`
    : tdeeReasonCopy(tdee || {});
  const vsWizard = tdee?.ok && wizardTdee
    ? `Wizard maintenance ~${wizardTdee} kcal.`
    : '';
  const weighLine = lastWeighIn
    ? `${lastWeighIn.kg} kg on ${lastWeighIn.date}`
    : 'No scale weigh-in yet';

  return `
    <details class="settings-details" id="adaptiveTdeePanel">
      <summary>14-day adaptive TDEE</summary>
      <div class="settings-details-body">
        <p class="fine-print">Compares logged intake with scale-weight change. Wellness estimate only — not medical advice.</p>
        <p class="phase3-stat" id="adaptiveTdeeValue" data-tdee="${tdee?.ok ? tdee.tdee : ''}">${escapeHtml(tdeeLine)}</p>
        ${vsWizard ? `<p class="fine-print">${escapeHtml(vsWizard)}</p>` : ''}
        <p class="fine-print">Latest weigh-in: ${escapeHtml(weighLine)}</p>
        <div class="wizard-grid">
          <label class="field">
            <span>Date</span>
            <input type="date" id="weighInDate" value="${escapeHtml(dateKey)}" />
          </label>
          <label class="field">
            <span>Weight (kg)</span>
            <input type="number" id="weighInKg" min="30" max="300" step="0.1" inputmode="decimal" placeholder="e.g. 72.4"/>
          </label>
        </div>
        <button type="button" class="btn btn-ghost full" id="saveWeighInBtn">Save weigh-in</button>
        ${tdee?.ok ? '<button type="button" class="btn btn-ghost full" id="applyAdaptiveTdeeBtn">Apply adaptive TDEE to calorie target</button>' : ''}
      </div>
    </details>

    <details class="settings-details" id="healthSyncPanel">
      <summary>Apple Health / Health Connect</summary>
      <div class="settings-details-body">
        <p class="phase3-stat">${escapeHtml(health.label)}</p>
        <p class="fine-print">${escapeHtml(health.detail)}</p>
        <label class="field">
          <span>Today's active energy (kcal)</span>
          <input type="number" id="activeEnergyKcal" min="0" max="20000" step="1" inputmode="numeric" value="${escapeHtml(todayEnergyKcal || '')}" placeholder="From watch or Health"/>
        </label>
        <button type="button" class="btn btn-ghost full" id="saveActiveEnergyBtn">Save active energy</button>
        <div class="phase3-health-actions">
          <button type="button" class="btn btn-ghost" id="exportHealthBtn">Export macros + energy</button>
          <button type="button" class="btn btn-ghost" id="importHealthBtn">Import Health file</button>
          <button type="button" class="btn btn-ghost" id="nativeHealthBtn">Sync native Health</button>
        </div>
        <input type="file" id="healthImportFile" accept="application/json,.json" hidden />
      </div>
    </details>
  `;
}

export function bindPhase3Settings(root, { showToast, onRefresh } = {}) {
  root.querySelector('#saveWeighInBtn')?.addEventListener('click', () => {
    try {
      addWeighIn({
        date: root.querySelector('#weighInDate')?.value,
        kg: root.querySelector('#weighInKg')?.value,
      });
      showToast?.('Weigh-in saved');
      onRefresh?.();
    } catch (err) {
      showToast?.(err.message || 'Could not save weigh-in');
    }
  });

  root.querySelector('#applyAdaptiveTdeeBtn')?.addEventListener('click', () => {
    const tdee = Number(root.querySelector('#adaptiveTdeeValue')?.dataset?.tdee);
    const input = root.querySelector('[name="calories_kcal"]');
    if (!input || !Number.isFinite(tdee) || tdee <= 0) {
      showToast?.('Adaptive TDEE is not ready yet');
      return;
    }
    input.value = String(tdee);
    showToast?.('Adaptive TDEE applied — review and save');
  });

  root.querySelector('#saveActiveEnergyBtn')?.addEventListener('click', () => {
    try {
      setActiveEnergyForDate(todayKey(), root.querySelector('#activeEnergyKcal')?.value);
      showToast?.('Active energy saved for today');
    } catch (err) {
      showToast?.(err.message || 'Could not save active energy');
    }
  });

  root.querySelector('#exportHealthBtn')?.addEventListener('click', async () => {
    try {
      const bundle = await collectHealthBundle();
      downloadHealthBundle(bundle);
      showToast?.('Health sync file downloaded');
    } catch (err) {
      showToast?.(err.message || 'Export failed');
    }
  });

  const fileInput = root.querySelector('#healthImportFile');
  root.querySelector('#importHealthBtn')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const parsed = parseHealthImport(await file.text());
      applyHealthImport(parsed, { addWeighInFn: addWeighIn });
      showToast?.('Health file imported');
      onRefresh?.();
    } catch (err) {
      showToast?.(err.message || 'Import failed');
    }
  });

  root.querySelector('#nativeHealthBtn')?.addEventListener('click', async () => {
    try {
      const bundle = await collectHealthBundle();
      const result = await tryNativeHealthSync({ bundle });
      if (result.ok) {
        showToast?.(`Synced to ${result.bridge.name}`);
        return;
      }
      if (result.reason === 'no_plugin') {
        showToast?.('No Apple Health / Health Connect plugin on this build — use Export');
        return;
      }
      showToast?.('Health plugin found but the save API is not available — use Export');
    } catch (err) {
      showToast?.(err.message || 'Native Health sync failed');
    }
  });
}
