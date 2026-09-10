/** Supplement logging — personal diary entries, not merged into meal calorie totals. */

export const SUPPLEMENT_MEAL_TYPE = 'supplement';
export const SUPPLEMENT_SOURCE = 'supplement';

export const SUPPLEMENT_TIME_OPTIONS = [
  { id: 'morning', label: 'Morning' },
  { id: 'midday', label: 'Midday' },
  { id: 'evening', label: 'Evening' },
  { id: 'bedtime', label: 'Bedtime' },
  { id: 'anytime', label: 'Any time' },
];

const TIME_LABELS = Object.fromEntries(SUPPLEMENT_TIME_OPTIONS.map((o) => [o.id, o.label]));

export function isSupplementEntry(meal) {
  if (!meal) return false;
  return meal.meal_type === SUPPLEMENT_MEAL_TYPE || meal.source === SUPPLEMENT_SOURCE;
}

/** Split a day's entries into food meals vs supplement logs. */
export function partitionMealsByKind(meals = []) {
  const food = [];
  const supplements = [];
  for (const meal of meals) {
    if (isSupplementEntry(meal)) supplements.push(meal);
    else food.push(meal);
  }
  return { food, supplements };
}

export function supplementTimeLabel(id) {
  return TIME_LABELS[id] || TIME_LABELS.anytime;
}

export function supplementMetaFromMeal(meal) {
  const item = meal?.items?.[0] || {};
  return {
    name: meal?.meal_summary || item.name || '',
    brand: item.brand || '',
    dose: item.dose || '',
    timeOfDay: item.time_of_day || 'anytime',
    notes: meal?.meal_notes || '',
    barcode: meal?.barcode || item.barcode || '',
    micronutrients: item.micronutrients || null,
  };
}

export function formatMicronutrientLine(micronutrients) {
  if (!micronutrients || typeof micronutrients !== 'object') return '';
  const parts = Object.values(micronutrients)
    .filter((m) => m && Number(m.value) > 0)
    .map((m) => `${m.label} ${m.value}${m.unit}`);
  return parts.join(' · ');
}

/** Sum micronutrients across supplement entries for one day (same units per key). */
export function aggregateDayMicronutrients(entries = []) {
  const totals = {};
  for (const entry of entries) {
    const micros = entry?.items?.[0]?.micronutrients;
    if (!micros) continue;
    for (const [key, data] of Object.entries(micros)) {
      if (!data || !Number(data.value)) continue;
      if (!totals[key]) {
        totals[key] = { ...data, value: 0 };
      }
      if (totals[key].unit === data.unit) {
        totals[key].value = round2(totals[key].value + Number(data.value));
      }
    }
  }
  return totals;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

export function buildSupplementMealRecord({
  name,
  brand,
  dose,
  timeOfDay,
  notes,
  date,
  id,
  createdAt,
  barcode,
  micronutrients,
}) {
  const trimmedName = String(name || '').trim();
  const trimmedBrand = String(brand || '').trim();
  const trimmedDose = String(dose || '').trim();
  const trimmedNotes = String(notes || '').trim();
  const when = SUPPLEMENT_TIME_OPTIONS.some((o) => o.id === timeOfDay) ? timeOfDay : 'anytime';

  return {
    id,
    createdAt,
    date,
    meal_type: SUPPLEMENT_MEAL_TYPE,
    source: SUPPLEMENT_SOURCE,
    meal_summary: trimmedName,
    meal_notes: trimmedNotes,
    total_calories_kcal: 0,
    total_nutrition: {
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fibre_g: 0,
      sugar_g: 0,
      salt_mg: 0,
    },
    barcode: barcode ? String(barcode).replace(/\D/g, '') : undefined,
    items: [
      {
        name: trimmedName,
        brand: trimmedBrand,
        dose: trimmedDose,
        time_of_day: when,
        barcode: barcode ? String(barcode).replace(/\D/g, '') : undefined,
        micronutrients: micronutrients && Object.keys(micronutrients).length ? micronutrients : undefined,
      },
    ],
  };
}

export function formatSupplementMetaLine(meta) {
  const parts = [];
  if (meta.brand) parts.push(meta.brand);
  if (meta.dose) parts.push(meta.dose);
  parts.push(supplementTimeLabel(meta.timeOfDay));
  return parts.join(' · ');
}
