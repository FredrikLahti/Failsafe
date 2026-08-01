import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Database, ExperienceType } from "@/lib/types/database";

type GiftCardDeliveryInsert = Database["public"]["Tables"]["gift_card_deliveries"]["Insert"];

const TREMENDOUS_API_BASE =
  process.env.TREMENDOUS_API_BASE ?? "https://testflight.tremendous.com/api/v2";

/**
 * Tremendous product IDs are account- and region-specific catalog entries.
 * These env vars must point at category-locked gift card products — verified
 * against a live sandbox account to mean `category: "merchant_card"` in
 * Tremendous's own schema (a single-brand card, e.g. "Ticketmaster SE"),
 * never `category: "visa_card"` (their general-purpose flexible reward), so
 * the value can't be redirected to unrelated spending. Delivery is skipped
 * with a clear 'failed' status + reason until these are configured.
 */
const CATEGORY_PRODUCT_ENV: Record<ExperienceType, string> = {
  dinner: "TREMENDOUS_PRODUCT_DINNER",
  tickets_event: "TREMENDOUS_PRODUCT_TICKETS_EVENT",
  trip: "TREMENDOUS_PRODUCT_TRIP",
  activity: "TREMENDOUS_PRODUCT_ACTIVITY",
  other: "TREMENDOUS_PRODUCT_OTHER",
};

function isTremendousConfigured(): boolean {
  return Boolean(process.env.TREMENDOUS_API_KEY && process.env.TREMENDOUS_FUNDING_SOURCE_ID);
}

function centsToWholeUnits(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Splits a total evenly across beneficiaries in whole cents, handing any
 * remainder to the first beneficiary so the sum always matches exactly.
 */
function splitEvenly(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

interface TremendousSku {
  min: number;
  max: number;
}

interface TremendousProduct {
  id: string;
  skus: TremendousSku[];
}

/** Looks up a single catalog product's accepted denominations. Fails to null rather than throwing — callers treat "unknown" and "no skus" the same way. */
async function fetchProduct(productId: string): Promise<TremendousProduct | null> {
  try {
    const res = await fetch(`${TREMENDOUS_API_BASE}/products/${productId}`, {
      headers: { Authorization: `Bearer ${process.env.TREMENDOUS_API_KEY}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { product?: TremendousProduct };
    return data.product ?? null;
  } catch {
    return null;
  }
}

/**
 * Tremendous catalog products either offer a flexible denomination range (a
 * single sku with min < max, e.g. "Ticketmaster SE" 100-2500) or a fixed
 * list of exact denominations (every sku has min === max, e.g. "Ving SE"
 * only sells exactly 1000 or 1500 SEK) — confirmed against a live sandbox
 * catalog, not documented anywhere obvious in the spec. Sending an order for
 * a fixed-denomination product with a non-matching amount fails at
 * Tremendous with no useful detail surfaced back to us, so this resolves the
 * actual amount to order up front: clamps into range for a flexible
 * product, snaps to the nearest allowed value (ties round down) for a fixed
 * list. The delivered gift card's value can therefore differ slightly from
 * the exact stake amount captured via Stripe — see PAYMENTS.md. Returns
 * null only if the product has no skus at all.
 */
function resolveDenomination(product: TremendousProduct, desiredWholeUnits: number): number | null {
  if (!product.skus || product.skus.length === 0) return null;

  const flexible = product.skus.find((s) => s.max > s.min);
  if (flexible) {
    return Math.min(Math.max(desiredWholeUnits, flexible.min), flexible.max);
  }

  const allowed = [...new Set(product.skus.map((s) => s.min))].sort((a, b) => a - b);
  let closest = allowed[0];
  let closestDiff = Math.abs(desiredWholeUnits - closest);
  for (const value of allowed) {
    const diff = Math.abs(desiredWholeUnits - value);
    if (diff < closestDiff) {
      closest = value;
      closestDiff = diff;
    }
  }
  return closest;
}

interface DeliverGiftCardsInput {
  challengeId: string;
  beneficiaries: string[];
  experienceType: ExperienceType;
  totalAmountCents: number;
  /** Optional shared contact captured at onboarding — see reserveStake/challenges.beneficiary_email. */
  beneficiaryEmail?: string | null;
  /** Optional shared contact captured at onboarding — see challenges.beneficiary_phone. Preferred over email when both are set. */
  beneficiaryPhone?: string | null;
}

type DeliveryMethod = "PHONE" | "EMAIL" | "LINK";

/** PHONE (SMS) is preferred over EMAIL over LINK when more than one contact method is on file — SMS is the most universally reachable option per user feedback. */
function resolveDeliveryMethod(phone?: string | null, email?: string | null): DeliveryMethod {
  if (phone?.trim()) return "PHONE";
  if (email?.trim()) return "EMAIL";
  return "LINK";
}

interface DeliveryRecoveryContext {
  challengeId: string;
  beneficiaryName: string;
  tremendousOrderId?: string | null;
  tremendousRewardId?: string | null;
  claimUrl?: string | null;
}

/**
 * Inserts a gift_card_deliveries row, retrying a few times on failure. This
 * runs immediately after a Tremendous order has already been created and
 * charged — the claim link (and expiry) only ever appear in that order
 * creation response (confirmed: neither GET /orders/{id} nor GET
 * /rewards/{id} return it afterward), so this write is the one and only
 * chance to persist it. If every retry still fails, the money has already
 * been spent and the link may be permanently unrecoverable via the API, so
 * this logs a distinct, high-visibility error rather than folding into the
 * generic failure path — see PAYMENTS.md for why this needs real alerting
 * (a paging/Slack/Sentry hook) in production, not just a console log.
 */
async function insertDeliveryWithRetry(
  row: GiftCardDeliveryInsert,
  context: DeliveryRecoveryContext
): Promise<void> {
  const supabase = createServiceRoleClient();
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { error } = await supabase.from("gift_card_deliveries").insert(row);
    if (!error) return;

    console.error(
      `[tremendous] insert attempt ${attempt}/${maxAttempts} failed for challenge ${context.challengeId}, beneficiary "${context.beneficiaryName}":`,
      error.message
    );
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  console.error(
    "[tremendous:CRITICAL] Gift card order was charged and executed by Tremendous, but recording " +
      "it in our database failed after retries. The claim link is likely unrecoverable via the API " +
      "from this point on — manual recovery via the Tremendous dashboard is needed.",
    JSON.stringify({
      challengeId: context.challengeId,
      beneficiaryName: context.beneficiaryName,
      tremendousOrderId: context.tremendousOrderId ?? null,
      tremendousRewardId: context.tremendousRewardId ?? null,
      claimUrl: context.claimUrl ?? null,
    })
  );
}

/**
 * Creates one category-locked Tremendous reward per beneficiary and stores
 * the delivery record. Confirmed against Tremendous's own API spec:
 * recipient.email is optional (only `name` is required) — it's just the
 * field EMAIL delivery sends to. Delivery method preference: PHONE (SMS) if
 * a beneficiary phone number was captured at onboarding, else EMAIL if an
 * address was captured, else LINK with no contact info at all, surfacing
 * the claim URL (reward.delivery.link) on the public share page instead —
 * Kinwin doesn't require beneficiary contact info by design.
 */
export async function deliverGiftCards({
  challengeId,
  beneficiaries,
  experienceType,
  totalAmountCents,
  beneficiaryEmail,
  beneficiaryPhone,
}: DeliverGiftCardsInput): Promise<void> {
  const supabase = createServiceRoleClient();
  const configuredProductId = process.env[CATEGORY_PRODUCT_ENV[experienceType]];
  const amounts = splitEvenly(totalAmountCents, beneficiaries.length);
  const method = resolveDeliveryMethod(beneficiaryPhone, beneficiaryEmail);

  if (!isTremendousConfigured() || !configuredProductId) {
    console.log(
      "[tremendous:stub] Tremendous not configured — logging orders instead of calling the API:",
      JSON.stringify(
        beneficiaries.map((name, i) => ({
          challengeId,
          recipient:
            method === "PHONE"
              ? { name, phone: beneficiaryPhone!.trim() }
              : method === "EMAIL"
                ? { name, email: beneficiaryEmail!.trim() }
                : { name },
          delivery: method,
          value: { denomination: centsToWholeUnits(amounts[i]), currency_code: "SEK" },
          experienceType,
        }))
      )
    );
    const { error } = await supabase.from("gift_card_deliveries").insert(
      beneficiaries.map((name, i) => ({
        challenge_id: challengeId,
        beneficiary_name: name,
        amount_cents: amounts[i],
        experience_type: experienceType,
        status: "failed" as const,
      }))
    );
    if (error) {
      console.error(`[tremendous] stub: failed to record skipped deliveries for challenge ${challengeId}:`, error.message);
    }
    return;
  }

  // Resolved once per challenge — every beneficiary shares the same
  // experience type, so the same catalog product and fallback decision
  // applies to all of them.
  let productId = configuredProductId;
  let product = await fetchProduct(configuredProductId);
  if (!product) {
    const fallbackId = process.env.TREMENDOUS_PRODUCT_FALLBACK;
    if (fallbackId) {
      console.log(
        `[tremendous] could not look up catalog product ${configuredProductId} for experience type "${experienceType}" — falling back to the configured flexible product ${fallbackId}. This reward will not be category-locked.`
      );
      productId = fallbackId;
      product = await fetchProduct(fallbackId);
    } else {
      console.error(
        `[tremendous] could not look up catalog product ${configuredProductId} for experience type "${experienceType}" and no TREMENDOUS_PRODUCT_FALLBACK is configured — proceeding with the raw stake amount; the order may fail at Tremendous if it doesn't match an accepted denomination.`
      );
    }
  }

  await Promise.all(
    beneficiaries.map(async (name, i) => {
      const amountCents = amounts[i];
      const desiredWholeUnits = centsToWholeUnits(amountCents);
      let denomination = desiredWholeUnits;

      if (product) {
        const resolved = resolveDenomination(product, desiredWholeUnits);
        if (resolved != null && resolved !== desiredWholeUnits) {
          console.log(
            `[tremendous] rounded denomination for product ${productId} (challenge ${challengeId}, beneficiary "${name}") from ${desiredWholeUnits} to ${resolved} SEK — nearest amount the catalog product accepts.`
          );
          denomination = resolved;
        }
      }

      try {
        const res = await fetch(`${TREMENDOUS_API_BASE}/orders`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.TREMENDOUS_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payment: { funding_source_id: process.env.TREMENDOUS_FUNDING_SOURCE_ID },
            rewards: [
              {
                value: { denomination, currency_code: "SEK" },
                delivery: { method },
                products: [productId],
                recipient:
                  method === "PHONE"
                    ? { name, phone: beneficiaryPhone!.trim() }
                    : method === "EMAIL"
                      ? { name, email: beneficiaryEmail!.trim() }
                      : { name },
              },
            ],
          }),
        });

        if (!res.ok) throw new Error(`Tremendous order failed: ${res.status}`);

        const data = (await res.json()) as {
          order?: {
            id?: string;
            rewards?: { id?: string; expires_at?: string; delivery?: { link?: string } }[];
          };
        };
        const reward = data.order?.rewards?.[0];

        // The order is already placed and charged at this point — the write
        // below is the only chance to persist the claim link/expiry, hence
        // the retry + critical-log handling inside insertDeliveryWithRetry
        // rather than a plain insert.
        await insertDeliveryWithRetry(
          {
            challenge_id: challengeId,
            beneficiary_name: name,
            amount_cents: amountCents,
            experience_type: experienceType,
            tremendous_order_id: data.order?.id ?? null,
            tremendous_reward_id: reward?.id ?? null,
            claim_url: reward?.delivery?.link ?? null,
            expires_at: reward?.expires_at ?? null,
            status: "sent",
            delivered_at: new Date().toISOString(),
          },
          {
            challengeId,
            beneficiaryName: name,
            tremendousOrderId: data.order?.id,
            tremendousRewardId: reward?.id,
            claimUrl: reward?.delivery?.link,
          }
        );
      } catch (err) {
        console.error(
          `[tremendous] order failed for challenge ${challengeId}, beneficiary "${name}":`,
          err instanceof Error ? err.message : err
        );
        const { error } = await supabase.from("gift_card_deliveries").insert({
          challenge_id: challengeId,
          beneficiary_name: name,
          amount_cents: amountCents,
          experience_type: experienceType,
          status: "failed",
        });
        if (error) {
          console.error(`[tremendous] also failed to record the failed delivery for challenge ${challengeId}, beneficiary "${name}":`, error.message);
        }
      }
    })
  );
}
