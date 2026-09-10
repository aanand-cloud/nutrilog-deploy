/**
 * MNova name personalisation — warm when it helps, never robotic.
 * Client builds signals; the model follows context.personalization.guidance.
 */

import { getLocalDisplayName, getProfile } from './profile.js';
import { APP_NAME } from './brand.js';

/** Min assistant replies between using the user's first name again. */
export const MIN_ASSISTANT_REPLIES_BETWEEN_NAME = 3;

/** Soft cap per chat session (welcome counts separately in UI). */
export const MAX_NAME_USES_PER_SESSION = 5;

export function firstNameFromDisplayName(name = '') {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0];
}

function greetingPeriod() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** @typedef {{ role: 'user' | 'assistant', content: string }} MnovaTurn */

export async function resolveMnovaFirstName() {
  const local = firstNameFromDisplayName(getLocalDisplayName());
  if (local) return local;
  try {
    const profile = await getProfile();
    if (profile?.loggedIn && profile.displayName) {
      return firstNameFromDisplayName(profile.displayName);
    }
  } catch (_) {
    /* guest or offline */
  }
  return '';
}

export function buildMnovaWelcomeMessage(firstName = '') {
  const name = firstNameFromDisplayName(firstName);
  const lead = name ? `${greetingPeriod()}, ${name}!` : 'Hi there!';
  return `${lead} I'm MNova, your ${APP_NAME} assistant. How can I help you today? Ask about logging meals, how calories are calculated, or your Today totals — or tap a suggestion below.`;
}

function escapeRegExp(text = '') {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function countNameInText(text = '', firstName = '') {
  const name = firstNameFromDisplayName(firstName);
  if (!name) return 0;
  const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi');
  return (String(text).match(re) || []).length;
}

export function countHistoryTurns(history = []) {
  const turns = Array.isArray(history) ? history : [];
  return {
    userTurns: turns.filter((t) => t.role === 'user').length,
    assistantTurns: turns.filter((t) => t.role === 'assistant').length,
  };
}

/** Assistant replies since firstName last appeared in stored history. */
export function assistantRepliesSinceLastName(history = [], firstName = '') {
  const name = firstNameFromDisplayName(firstName);
  const turns = Array.isArray(history) ? history : [];
  if (!name) return turns.filter((t) => t.role === 'assistant').length;

  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i].role !== 'assistant') continue;
    if (countNameInText(turns[i].content, name) > 0) {
      return turns.slice(i + 1).filter((t) => t.role === 'assistant').length;
    }
  }
  return turns.filter((t) => t.role === 'assistant').length;
}

export function countNameUsesInHistory(history = [], firstName = '') {
  const name = firstNameFromDisplayName(firstName);
  if (!name) return 0;
  return (Array.isArray(history) ? history : [])
    .filter((t) => t.role === 'assistant')
    .reduce((sum, t) => sum + countNameInText(t.content, name), 0);
}

/**
 * Build structured signal for the model — when name use is welcome vs off-limits.
 * @param {{ firstName?: string, history?: MnovaTurn[] }} opts
 */
export function buildPersonalizationSignal({ firstName = '', history = [] } = {}) {
  const name = firstNameFromDisplayName(firstName);
  if (!name) {
    return { enabled: false, guidance: 'No first name available — do not invent one.' };
  }

  const { userTurns, assistantTurns } = countHistoryTurns(history);
  const repliesSinceName = assistantRepliesSinceLastName(history, name);
  const nameUsesInSession = countNameUsesInHistory(history, name);
  const underSessionCap = nameUsesInSession < MAX_NAME_USES_PER_SESSION;
  const spacingOk = repliesSinceName >= MIN_ASSISTANT_REPLIES_BETWEEN_NAME;
  const mayUseNameThisReply = underSessionCap && spacingOk;

  return {
    enabled: true,
    firstName: name,
    userTurnsInSession: userTurns,
    assistantTurnsInSession: assistantTurns,
    nameUsesInSession,
    assistantRepliesSinceLastName: repliesSinceName,
    mayUseNameThisReply,
    useNameWhen: [
      'Encouraging them about meals logged or progress toward goals',
      'Acknowledging a balanced day or helpful logging habit',
      'Empathetic tone when they seem stuck or frustrated',
      'Rare warm sign-off after a helpful answer (at most once per few replies)',
    ],
    skipNameWhen: [
      'Technical how-to, steps, or bullet lists',
      'Pure factual nutrition or calorie maths',
      'Errors, limits, or sign-in prompts',
      'Every reply — feels robotic',
      'Suggestion chips (never include their name in suggestions)',
    ],
    guidance: mayUseNameThisReply
      ? `You MAY use "${name}" once in this reply only if it adds genuine warmth (see useNameWhen). At most once in the reply.`
      : `Do NOT use "${name}" in this reply — spacing rule (${MIN_ASSISTANT_REPLIES_BETWEEN_NAME}+ assistant replies between names) or session cap. Stay friendly without the name.`,
  };
}
