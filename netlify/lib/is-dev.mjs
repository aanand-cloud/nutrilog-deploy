/** True only for `netlify dev` — never infer dev mode from URL (misconfiguration risk). */
export function isDevEnvironment(env = process.env) {
  return env.NETLIFY_DEV === 'true';
}
