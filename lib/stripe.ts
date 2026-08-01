import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Throws instead of crashing module load when unconfigured, so pages that
 * don't touch billing keep working in local/dev environments without keys.
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set — billing and stake capture are unavailable until it is configured."
    );
  }
  cached = new Stripe(key, { apiVersion: "2026-07-29.dahlia" });
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export const SUBSCRIPTION_BASE_PRICE_CENTS_SEK = 9900;

/** Flat fee added on top of a captured stake, covering Stripe + Tremendous processing. */
export const STAKE_CAPTURE_FEE_CENTS_SEK = 1200;
