import { extractUsageMetadata } from './gemini-usage.mjs';
import { FOOD_ANALYSIS_SCHEMA, VISION_FOOD_ANALYSIS_RESPONSE_SCHEMA } from './gemini-schemas.mjs';
import { parseLooseJson } from '../../shared/json-repair.js';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';
const VISION_MAX_OUTPUT_TOKENS = 8192;
const VISION_RETRY_MAX_OUTPUT_TOKENS = 16384;

export const FOOD_VISION_SYSTEM_PROMPT =
  'You are a precision vision and volume-estimation engine for MealNova. Identify every visible food and drink, estimate 3D volume, convert to grams or millilitres using typical food density, estimate absorbed oil or ghee in tablespoons when relevant, and return a standardized usda_search_term for each item so MealNova can look up nutrition in an external database. Never invent calories, protein, carbs, or fat. Always respond with a single JSON object that matches the provided response schema.';

export function defaultVisionModel() {
  return process.env.GEMINI_VISION_MODEL || 'gemini-3.1-flash-lite';
}

export function defaultTextModel() {
  return process.env.GEMINI_TEXT_MODEL || 'gemini-3.1-flash-lite';
}

export function parseGeminiJson(text) {
  return parseLooseJson(text);
}

export function thinkingConfigForModel(model = '') {
  if (/gemini-3/i.test(model)) return { thinkingConfig: { thinkingLevel: 'minimal' } };
  if (/gemini-2\.5-flash(?!-lite)/i.test(model)) return { thinkingConfig: { thinkingBudget: 0 } };
  return {};
}

function candidateText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const visible = parts
    .filter((part) => !part?.thought)
    .map((part) => part?.text)
    .filter((part) => typeof part === 'string' && part.trim())
    .join('\n');
  if (visible.trim()) return visible;
  return parts
    .map((part) => part?.text)
    .filter((part) => typeof part === 'string' && part.trim())
    .join('\n');
}

export async function geminiGenerate({
  apiKey,
  model,
  systemPrompt,
  parts,
  temperature = 0.2,
  maxOutputTokens = VISION_MAX_OUTPUT_TOKENS,
  responseSchema,
  thinkingConfig,
}) {
  const generationConfig = {
    temperature,
    maxOutputTokens,
    responseMimeType: 'application/json',
    ...(responseSchema ? { responseSchema } : {}),
    ...(thinkingConfig || thinkingConfigForModel(model)),
  };

  const res = await fetch(`${GEMINI_API}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      systemInstruction: systemPrompt
        ? { parts: [{ text: systemPrompt }] }
        : undefined,
      generationConfig,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    const retryWithoutThinking = res.status === 400 && generationConfig.thinkingConfig;
    if (retryWithoutThinking) {
      return geminiGenerate({
        apiKey,
        model,
        systemPrompt,
        parts,
        temperature,
        maxOutputTokens,
        responseSchema,
        thinkingConfig: {},
      });
    }
    throw new Error(`Gemini API request failed (${res.status}): ${err.slice(0, 280)}`);
  }

  const data = await res.json();
  const text = candidateText(data);
  const finishReason = data.candidates?.[0]?.finishReason;
  if (!text) {
    const err = new Error(
      finishReason === 'MAX_TOKENS'
        ? 'Empty response from Gemini model (truncated)'
        : 'Empty response from Gemini model',
    );
    err.finishReason = finishReason;
    throw err;
  }

  return {
    result: parseGeminiJson(text),
    usage: extractUsageMetadata(data),
    model,
    finishReason,
  };
}

export async function analyzeFoodWithGemini(apiKey, body, model = defaultVisionModel(), responseSchema) {
  const { image, mimeType = 'image/jpeg', prompt, context, userNotes } = body;
  const parts = [];
  if (userNotes?.trim()) {
    parts.push({
      text: `User description of the meal (trust for hidden ingredients, cooking method, portion size, and anything not visible in the photo):\n${userNotes.trim()}`,
    });
  }
  if (context) {
    parts.push({
      text: `Context from user clarifications:\n${JSON.stringify(context, null, 2)}`,
    });
  }
  parts.push({ text: prompt });
  parts.push({ inline_data: { mime_type: mimeType, data: image } });

  const schema = responseSchema || FOOD_ANALYSIS_SCHEMA || VISION_FOOD_ANALYSIS_RESPONSE_SCHEMA;
  try {
    return await geminiGenerate({
      apiKey,
      model,
      systemPrompt: FOOD_VISION_SYSTEM_PROMPT,
      parts,
      temperature: 0.1,
      maxOutputTokens: VISION_MAX_OUTPUT_TOKENS,
      responseSchema: schema,
    });
  } catch (err) {
    const retryable = /parse model JSON|Empty response|truncated|JSON|after array element/i.test(err?.message || '');
    if (!retryable) throw err;
    return geminiGenerate({
      apiKey,
      model,
      systemPrompt: FOOD_VISION_SYSTEM_PROMPT,
      parts,
      temperature: 0.1,
      maxOutputTokens: VISION_RETRY_MAX_OUTPUT_TOKENS,
    });
  }
}
