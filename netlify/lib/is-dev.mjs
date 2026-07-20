/** True only for local dev servers — never infer dev mode from URL (misconfiguration risk). */
export function isDevEnvironment(env = process.env) {
  return env.NETLIFY_DEV === 'true' || env.VERCEL_ENV === 'development';
}