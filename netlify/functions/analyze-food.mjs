import { analyzeFoodWithGemini } from '../lib/gemini.mjs';
import { ANALYSIS_PROMPT, CLARIFY_PROMPT } from '../lib/prompts.mjs';
import {
  checkScanAllowed,
  checkRefinementAllowed,
  consumeMealScan,
  isValidRefinementContext,
} from '../lib/scan-enforcement.mjs';
import { isDevEnvironment } from '../lib/is-dev.mjs';
import { getSupabaseAdmin, getAccessToken, verifyAccessToken } from '../lib/verify-auth.mjs';
import { corsHeaders, jsonResponse, optionsResponse } from '../lib/http-utils.mjs';

const MAX_IMAGE_CHARS = 6_000_000;

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req);
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'GEMINI_API_KEY not configured on server' }, 503, req);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const { image, mimeType = 'image/jpeg', context, userNotes, localDay } = body;

  if (!image) {
    return jsonResponse({ error: 'image is required' }, 400, req);
  }
  if (typeof image !== 'string' || image.length > MAX_IMAGE_CHARS) {
    return jsonResponse({ error: 'Image too large' }, 413, req);
  }

  const isRefinement = isValidRefinementContext(context);
  if (context && !isRefinement) {
    return jsonResponse({ error: 'Invalid refinement context' }, 400, req);
  }

  const requireAuth = !isDevEnvironment();
  const accessToken = getAccessToken(body, req);
  const supabaseAdmin = getSupabaseAdmin();

  if (requireAuth && !accessToken) {
    return jsonResponse({ error: 'Sign in required to log meals with AI', requiresAuth: true }, 401, req);
  }
  if (requireAuth && !supabaseAdmin) {
    return jsonResponse({ error: 'Server configuration incomplete — contact support' }, 503, req);
  }

  let userId = null;
  if (accessToken && supabaseAdmin) {
    const auth = await verifyAccessToken(accessToken);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error, requiresAuth: auth.requiresAuth }, auth.status || 401, req);
    }
    userId = auth.userId;
  }

  let usage = null;

  if (userId && supabaseAdmin) {
    const scanCheck = isRefinement
      ? await checkRefinementAllowed(supabaseAdmin, userId, localDay)
      : await checkScanAllowed(supabaseAdmin, userId, localDay);

    if (!scanCheck.ok) {
      return jsonResponse({ error: scanCheck.error || 'Scan limit reached' }, 429, req);
    }

    if (!isRefinement) {
      const consumed = await consumeMealScan(supabaseAdmin, userId, localDay);
      if (!consumed.ok) {
        return jsonResponse({ error: consumed.error || 'Scan limit reached' }, 429, req);
      }
      usage = consumed.usage;
    }
  }

  const prompt = isRefinement ? CLARIFY_PROMPT : ANALYSIS_PROMPT;

  try {
    const analysis = await analyzeFoodWithGemini(apiKey, {
      image,
      mimeType,
      prompt,
      context: isRefinement ? context : undefined,
      userNotes,
    });

    return jsonResponse({ analysis, usage }, 200, req);
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: e.message || 'Server error during analysis' }, 502, req);
  }
};
