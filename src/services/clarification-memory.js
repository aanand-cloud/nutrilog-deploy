/**
 * Pre-fill clarify answers from past logs of the same meal.
 */

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bucketKcal(kcal) {
  const n = Math.round(Number(kcal) || 0);
  if (n <= 0) return 0;
  return Math.round(n / 75) * 75;
}

function clarifyMealKey(analysis = {}) {
  const name = normalizeName(analysis.meal_summary);
  if (!name) return '';
  return `${name}:${bucketKcal(analysis.total_calories_kcal)}`;
}

function namesMatch(a = '', b = '') {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aWords = a.split(' ').filter((w) => w.length > 2);
  const bWords = b.split(' ').filter((w) => w.length > 2);
  if (!aWords.length || !bWords.length) return false;
  const overlap = aWords.filter((w) => bWords.includes(w)).length;
  return overlap >= Math.min(2, Math.min(aWords.length, bWords.length));
}

/**
 * @param {object} analysis Current photo/describe analysis
 * @param {object[]} meals Past logged meals (local or synced)
 * @returns {Record<string, string>} topic → answer
 */
export function getClarificationMemoryHints(analysis = {}, meals = []) {
  const targetName = normalizeName(analysis.meal_summary);
  const targetKey = clarifyMealKey(analysis);
  const hints = new Map();

  const ranked = meals
    .filter((meal) => Array.isArray(meal.clarifications) && meal.clarifications.length)
    .map((meal) => {
      const name = normalizeName(meal.meal_summary);
      const key = clarifyMealKey(meal);
      let score = 0;
      if (key && key === targetKey) score += 4;
      if (namesMatch(name, targetName)) score += 3;
      if (name === targetName) score += 2;
      return { meal, score, at: meal.createdAt || meal.updatedAt || '' };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => (b.score - a.score) || (b.at).localeCompare(a.at));

  for (const { meal } of ranked) {
    for (const entry of meal.clarifications) {
      const topic = entry?.topic;
      const answer = String(entry?.answer || '').trim();
      if (!topic || !answer || hints.has(topic)) continue;
      hints.set(topic, answer);
    }
  }

  return Object.fromEntries(hints);
}

/**
 * Map a remembered answer onto clarify control state for pre-fill.
 * @param {object} ui from getClarificationStepConfig
 * @param {string} memoryAnswer
 */
export function buildClarifyControlState(ui, memoryAnswer = '') {
  const answer = String(memoryAnswer || '').trim();
  if (!answer) return {};

  if (ui.controlType === 'choice') {
    const exact = (ui.options || []).find((o) => o === answer);
    if (exact) return { selectedChoice: exact, fromMemory: true };
    const fuzzy = (ui.options || []).find((o) => {
      const a = answer.toLowerCase();
      const oLower = o.toLowerCase();
      return oLower.includes(a) || a.includes(oLower.split(/[—(-]/)[0].trim());
    });
    if (fuzzy) return { selectedChoice: fuzzy, fromMemory: true };
    return { customValue: answer, fromMemory: true };
  }

  if (ui.controlType === 'preset_amount') {
    const preset = (ui.presets || []).find((p) => p.answer === answer || p.label === answer);
    if (preset) return { selectedPresetId: preset.id, fromMemory: true };
    const amount = answer.match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/i);
    if (amount) return { numericValue: amount[1], fromMemory: true };
    const approx = answer.match(/~\s*(\d+(?:\.\d+)?)/);
    if (approx) return { numericValue: approx[1], fromMemory: true };
    return { customValue: answer, fromMemory: true };
  }

  return { customValue: answer, fromMemory: true };
}

export function hasClarificationMemory(hints = {}) {
  return Object.keys(hints).length > 0;
}
