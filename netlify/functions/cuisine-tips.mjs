import { generateCuisineTips } from '../lib/cuisine-tips-core.mjs';
import { verifyAccessToken, requireAuthInProduction, getAccessToken } from '../lib/verify-auth.mjs';
import { jsonResponse, optionsResponse } from '../lib/http-utils.mjs';

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req);
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'GEMINI_API_KEY not configured' }, 503, req);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, req);
  }

  if (requireAuthInProduction()) {
    const auth = await verifyAccessToken(getAccessToken(body, req));
    if (!auth.ok) {
      return jsonResponse({ error: auth.error, requiresAuth: auth.requiresAuth }, auth.status || 401, req);
    }
  }

  try {
    const parsed = await generateCuisineTips(apiKey, body);
    return jsonResponse(parsed, 200, req);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: err.message || 'Failed to generate tips' }, 502, req);
  }
};
