/** Resolve a Stripe customer ID valid for the current API mode (live vs test). */

export async function clearStaleStripeBillingIds(supabase, userId) {
  if (!supabase || !userId) return;
  await supabase
    .from('profiles')
    .update({
      stripe_customer_id: null,
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

/**
 * Returns a customer ID that exists in the current Stripe account/mode, or null.
 * Clears stale test-mode IDs from profile when switching to live keys.
 */
export async function resolveStripeCustomerId(
  stripe,
  { customerId, email, supabase, userId } = {}
) {
  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(String(customerId));
      if (!customer.deleted) return String(customer.id);
      customerId = null;
    } catch (err) {
      const missing =
        err?.code === 'resource_missing'
        || /no such customer/i.test(String(err?.message || ''));
      if (missing) {
        await clearStaleStripeBillingIds(supabase, userId);
        customerId = null;
      } else {
        throw err;
      }
    }
  }

  if (email) {
    const listed = await stripe.customers.list({ email, limit: 5 });
    const match = listed.data.find((c) => !c.deleted);
    if (match?.id) return match.id;
  }

  return null;
}

export function stripeCustomerErrorMessage(err) {
  if (/no such customer/i.test(String(err?.message || ''))) {
    return 'Your billing profile was from a test account — please try checkout again.';
  }
  return err?.message || 'Checkout failed';
}
