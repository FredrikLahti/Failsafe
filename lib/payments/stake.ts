import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured, STAKE_CAPTURE_FEE_CENTS_SEK } from "@/lib/stripe";
import { deliverGiftCards } from "@/lib/tremendous";
import type { ExperienceType } from "@/lib/types/database";

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error(`[stake] hasActiveSubscription: query failed for user ${userId}:`, error.message);
    return false;
  }
  return data?.status === "active" || data?.status === "trialing";
}

/**
 * Snapshots the customer's on-file payment method (saved during subscription
 * checkout) against this challenge. This is the "authorize the stake"
 * step — no PaymentIntent is created yet, since Stripe can't hold an
 * authorization open for a 3-20 week challenge. Nothing is charged here.
 */
export async function reserveStake(
  challengeId: string,
  userId: string,
  amountCents: number
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = createServiceRoleClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (profileError) {
    console.error(`[stake] reserveStake: profile lookup failed for user ${userId}:`, profileError.message);
    return { ok: false, reason: "Could not look up your billing profile — try again." };
  }

  if (!profile?.stripe_customer_id) {
    return { ok: false, reason: "No Stripe customer on file — subscribe first." };
  }

  let paymentMethodId: string | null = null;

  if (isStripeConfigured()) {
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
    if (!("deleted" in customer)) {
      const defaultPm = customer.invoice_settings?.default_payment_method;
      paymentMethodId = typeof defaultPm === "string" ? defaultPm : (defaultPm?.id ?? null);
    }
    if (!paymentMethodId) {
      const methods = await stripe.paymentMethods.list({
        customer: profile.stripe_customer_id,
        type: "card",
        limit: 1,
      });
      paymentMethodId = methods.data[0]?.id ?? null;
    }
  }

  if (!paymentMethodId) {
    return { ok: false, reason: "No payment method on file for this customer." };
  }

  const { error } = await supabase.from("stake_payments").insert({
    challenge_id: challengeId,
    amount_cents: amountCents,
    currency: "sek",
    stripe_payment_method_id: paymentMethodId,
    status: "reserved",
  });

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/** Success outcome: nothing was ever charged, so this just closes the record out. */
export async function releaseStake(challengeId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("stake_payments")
    .update({ status: "released", updated_at: new Date().toISOString() })
    .eq("challenge_id", challengeId);
  if (error) {
    console.error(`[stake] releaseStake: failed to update challenge ${challengeId}:`, error.message);
  }
}

/**
 * Failure outcome: charges the saved payment method off-session for the
 * stake + flat fee, then hands off to Tremendous for gift-card delivery.
 * A declined/failed charge is marked 'capture_failed' — an admin-visible
 * edge case, not something the user is asked to resolve or re-report.
 */
export async function captureStake(
  challengeId: string,
  input: {
    beneficiaries: string[];
    experienceType: ExperienceType;
    beneficiaryEmail?: string | null;
    beneficiaryPhone?: string | null;
  }
): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: stake, error: stakeError } = await supabase
    .from("stake_payments")
    .select("*")
    .eq("challenge_id", challengeId)
    .single();

  if (stakeError) {
    console.error(`[stake] captureStake: stake_payments lookup failed for challenge ${challengeId}:`, stakeError.message);
    return;
  }
  if (!stake || !stake.stripe_payment_method_id) return;

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("user_id, profiles(stripe_customer_id)")
    .eq("id", challengeId)
    .single()
    .returns<{ user_id: string; profiles: { stripe_customer_id: string | null } | null }>();

  if (challengeError) {
    console.error(`[stake] captureStake: challenge lookup failed for challenge ${challengeId}:`, challengeError.message);
  }

  const customerId = challenge?.profiles?.stripe_customer_id;
  const feeCents = STAKE_CAPTURE_FEE_CENTS_SEK;

  if (!isStripeConfigured() || !customerId) {
    const { error } = await supabase
      .from("stake_payments")
      .update({ status: "capture_failed", updated_at: new Date().toISOString() })
      .eq("challenge_id", challengeId);
    if (error) {
      console.error(`[stake] captureStake: failed to mark capture_failed for challenge ${challengeId}:`, error.message);
    }
    await flagCaptureFailure(challengeId);
    return;
  }

  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: stake.amount_cents + feeCents,
      currency: stake.currency,
      customer: customerId,
      payment_method: stake.stripe_payment_method_id,
      off_session: true,
      confirm: true,
    });

    const { error } = await supabase
      .from("stake_payments")
      .update({
        status: "captured",
        fee_cents: feeCents,
        stripe_payment_intent_id: intent.id,
        captured_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("challenge_id", challengeId);
    if (error) {
      console.error(`[stake] captureStake: charge succeeded (${intent.id}) but failed to record it for challenge ${challengeId}:`, error.message);
    }

    await deliverGiftCards({
      challengeId,
      beneficiaries: input.beneficiaries,
      experienceType: input.experienceType,
      totalAmountCents: stake.amount_cents,
      beneficiaryEmail: input.beneficiaryEmail,
      beneficiaryPhone: input.beneficiaryPhone,
    });
  } catch (err) {
    console.error(`[stake] captureStake: charge failed for challenge ${challengeId}:`, err instanceof Error ? err.message : err);
    const { error } = await supabase
      .from("stake_payments")
      .update({ status: "capture_failed", updated_at: new Date().toISOString() })
      .eq("challenge_id", challengeId);
    if (error) {
      console.error(`[stake] captureStake: failed to mark capture_failed for challenge ${challengeId}:`, error.message);
    }
    await flagCaptureFailure(challengeId);
  }
}

/** Surfaces a declined capture to the admin dashboard without changing what the user sees on their result page. */
async function flagCaptureFailure(challengeId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("challenges")
    .update({ status: "completed_failure_unpaid" })
    .eq("id", challengeId);
  if (error) {
    console.error(`[stake] flagCaptureFailure: failed to update challenge ${challengeId}:`, error.message);
  }
}
