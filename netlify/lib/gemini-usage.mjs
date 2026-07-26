/** Lightweight Gemini token/cost helpers (usageMetadata from generateContent). */

/** USD per 1M tokens — Gemini 3.1 Flash-Lite standard tier (ai.google.dev, Jul 2026). */
const MODEL_RATES = {
  'gemini-3.1-flash-lite': { inputPerM: 0.25, outputPerM: 1.5 },
  'gemini-3.5-flash-lite': { inputPerM: 0.3, outputPerM: 2.5 },
  'gemini-2.5-flash-lite': { inputPerM: 0.1, outputPerM: 0.4 },
  'gemini-2.0-flash': { inputPerM: 0.1, outputPerM: 0.4 },
  'gemini-2.0-flash-lite': { inputPerM: 0.075, outputPerM: 0.3 },
};

const DEFAULT_RATES = MODEL_RATES['gemini-3.1-flash-lite'];

export function extractUsageMetadata(apiResponse) {
  const u = apiResponse?.usageMetadata;
  if (!u) return null;
  return {
    promptTokenCount: u.promptTokenCount ?? 0,
    candidatesTokenCount: u.candidatesTokenCount ?? 0,
    totalTokenCount: u.totalTokenCount ?? 0,
    cachedContentTokenCount: u.cachedContentTokenCount ?? 0,
  };
}

export function ratesForModel(model = '') {
  const id = String(model || '').trim();
  if (MODEL_RATES[id]) return MODEL_RATES[id];
  const prefix = Object.keys(MODEL_RATES).find((key) => id.startsWith(key));
  return prefix ? MODEL_RATES[prefix] : DEFAULT_RATES;
}

export function estimateGeminiCostUsd(usage, model) {
  if (!usage) return 0;
  const { inputPerM, outputPerM } = ratesForModel(model);
  const input = Number(usage.promptTokenCount) || 0;
  const output = Number(usage.candidatesTokenCount) || 0;
  return (input * inputPerM + output * outputPerM) / 1_000_000;
}

/** One JSON line for Vercel/Netlify logs — search `gemini_usage`. */
export function logGeminiUsage({ operation, model, usage, extra = {} }) {
  if (!usage) return;
  const promptTokens = usage.promptTokenCount ?? 0;
  const outputTokens = usage.candidatesTokenCount ?? 0;
  if (!promptTokens && !outputTokens) return;

  const estimatedUsd = estimateGeminiCostUsd(usage, model);
  console.log(JSON.stringify({
    tag: 'gemini_usage',
    operation,
    model: model || 'unknown',
    promptTokens,
    outputTokens,
    totalTokens: usage.totalTokenCount ?? promptTokens + outputTokens,
    cachedTokens: usage.cachedContentTokenCount ?? 0,
    estimatedUsd: Number(estimatedUsd.toFixed(6)),
    ...extra,
  }));
}

/** Small object safe to return in API responses (optional debugging). */
export function geminiUsageSummary(usage, model) {
  if (!usage) return undefined;
  const estimatedUsd = estimateGeminiCostUsd(usage, model);
  return {
    model: model || undefined,
    promptTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
    totalTokens: usage.totalTokenCount ?? 0,
    estimatedUsd: Number(estimatedUsd.toFixed(6)),
  };
}
