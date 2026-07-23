import { getSession, signOut } from './auth.js';
import { clearPrivacyConsentLocal } from './privacy-consent.js';

export async function deleteMyAccount() {
  const session = await getSession();
  if (!session?.access_token) {
    throw new Error('Sign in to delete your account');
  }

  const res = await fetch('/api/delete-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      accessToken: session.access_token,
      confirmDelete: true,
    }),
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : {};

  if (!res.ok) {
    throw new Error(data.error || `Could not delete account (${res.status})`);
  }

  clearPrivacyConsentLocal();
  await signOut();
  return data;
}
