import { extractUsageMetadata } from './gemini-usage.mjs';
import { FOOD_ANALYSIS_SCHEMA, VISION_FOOD_ANALYSIS_RESPONSE_SCHEMA } from './gemini-schemas.mjs';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';

export const FOOD_VISION_SYSTEM_PROMPT =
  'You are a precision vision and volume-estimation engine for MealNova. Identify every visible food and drink, estimate 3D volume, convert to grams or millilitres using typical food density, estimate absorbed oil or ghee in tablespoons when relevant, and return a standardized usda_search_term for each item so MealNova can look up nutrition in an external database. Never invent calories, protein, carbs, or fat. Always respond with a single JSON object that matches the provided response schema.';

export function defaultVisionModel() {
  return process.env.GEMINI_VISION_MODEL || 'gemini-3.1-flash-lite';
}

export function defaultTextModel() {
  return process.env.GEMINI_TEXT_MODEL || 'gemini-3.1-flash-lite';
}

export function parseGeminiJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse model JSON');
    return JSON.parse(match[0]);
  }
}

export async function geminiGenerate({
  apiKey,
  model,
  systemPrompt,
  parts,
  temperature = 0.2,
  maxOutputTokens = 1200,
  responseSchema,
}) {
  const generationConfig = {
    temperature,
    maxOutputTokens,
    responseMimeType: 'application/json',
    ...(responseSchema ? { responseSchema } : {}),
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
    throw new Error(`Gemini API request failed (${res.status}): ${err.slice(0, 280)}`);
  }

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || [])
    .map((part) => part?.text)
    .filter((part) => typeof part === 'string' && part.trim())
    .join('\n');
  if (!text) throw new Error('Empty response from Gemini model');

  return {
    result: parseGeminiJson(text),
    usage: extractUsageMetadata(data),
    model,
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

  return geminiGenerate({
    apiKey,
    model,
    systemPrompt: FOOD_VISION_SYSTEM_PROMPT,
    parts,
    temperature: 0.1,
    maxOutputTokens: 1200,
    responseSchema: responseSchema || FOOD_ANALYSIS_SCHEMA || VISION_FOOD_ANALYSIS_RESPONSE_SCHEMA,
  });
}
