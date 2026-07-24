import { getSession, isSupabaseConfigured } from './auth.js';
import { syncScanUsageFromServer, getLocalDayKey } from './subscription.js';
import { compressImage, compressDataUrl } from './image-compress.js';
import { needsClarification } from './clarification-questions.js';

export { compressImage, compressDataUrl, needsClarification };

async function authPayload() {
  if (isSupabaseConfigured()) {
    const session = await getSession();
    if (!session?.access_token) {
      const err = new Error('Sign in required to log meals with AI');
      err.requiresAuth = true;
      throw err;
    }
    return { accessToken: session.access_token, localDay: getLocalDayKey() };
  }
  return { localDay: getLocalDayKey() };
}

async function authHeaders() {
  const session = await getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

export async function analyzeFoodPhoto(imageBase64, mimeType = 'image/jpeg', userNotes = '') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch('/api/analyze-food', {
      method: 'POST',
      headers: await authHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        image: imageBase64,
        mimeType,
        userNotes: userNotes?.trim() || undefined,
        ...(await authPayload()),
      }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        import.meta.env.PROD
          ? 'Photo AI needs a full site deploy — barcode and food search still work.'
          : 'Server returned an unexpected response — refresh and try again.'
      );
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = err.error || `Analysis failed (${res.status})`;
      const error = new Error(message);
      if (err.requiresAuth) error.requiresAuth = true;
      if (res.status === 429) error.limitReached = true;
      throw error;
    }
    const data = await res.json();
    const analysis = parseAnalysisResponse(data);
    if (data.usage) syncScanUsageFromServer(data.usage);
    if (data.demo) analysis.demo = true;
    return analysis;
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Analysis took too long — try again with a smaller photo');
    }
    if (err instanceof TypeError) {
      throw new Error(
        import.meta.env.PROD
          ? 'Could not reach the server — try barcode or food search, or refresh after an update.'
          : 'Could not reach the server — check you are on the latest dev URL and refresh'
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function refineWithClarifications(imageBase64, mimeType, previousAnalysis, answers, userNotes = '') {
  const context = {
    previous: previousAnalysis,
    answers: answers.map((a) => ({ question: a.question, answer: a.answer })),
  };
  const res = await fetch('/api/analyze-food', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      image: imageBase64,
      mimeType,
      context,
      userNotes: userNotes?.trim() || undefined,
      ...(await authPayload()),
    }),
  });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      import.meta.env.PROD
        ? 'Photo AI needs a full site deploy — barcode and food search still work.'
        : 'Server returned an unexpected response — refresh and try again.'
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err.error || `Refinement failed (${res.status})`;
    const error = new Error(message);
    if (err.requiresAuth) error.requiresAuth = true;
    throw error;
  }
  return parseAnalysisResponse(await res.json());
}

function parseAnalysisResponse(data) {
  const raw = data.analysis || data;
  if (typeof raw === 'string') {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid analysis response');
    return JSON.parse(jsonMatch[0]);
  }
  return raw;
}


export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, dataUrl, mimeType: file.type || 'image/jpeg' });
    };
    reader.onerror = () => reject(reader.error);
  });
}

/** Demo analysis when API is unavailable (dev / offline) */
export function demoAnalysis() {
  return {
    meal_summary: 'Medium banana',
    total_calories_kcal: 105,
    total_nutrition: { protein_g: 1.3, carbs_g: 27, fat_g: 0.4, sugar_g: 14, fibre_g: 3.1, salt_mg: 1 },
    confidence_score: 0.85,
    items: [
      {
        name: 'Banana',
        portion_estimate: '1 medium (~118g)',
        calories_kcal: 105,
        nutrition: { protein_g: 1.3, carbs_g: 27, fat_g: 0.4 },
        confidence: 0.85,
      },
    ],
    clarification_questions: [],
  };
}
