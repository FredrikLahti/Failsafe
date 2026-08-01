import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ExperienceType } from "@/lib/types/database";

const TREMENDOUS_API_BASE =
  process.env.TREMENDOUS_API_BASE ?? "https://testflight.tremendous.com/api/v2";

/**
 * Tremendous product IDs are account- and region-specific catalog entries.
 * These env vars must point at category-locked gift card products (a
 * specific restaurant/event/travel/experience brand), never Tremendous's
 * general-purpose flexible/Visa reward, so the value can't be redirected to
 * unrelated spending. Left unset here since no real catalog IDs are
 * available in this environment — delivery is skipped with a clear
 * 'failed' status + reason until these are configured.
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

interface DeliverGiftCardsInput {
  challengeId: string;
  beneficiaries: string[];
  experienceType: ExperienceType;
  totalAmountCents: number;
  /** Optional shared contact captured at onboarding — see reserveStake/challenges.beneficiary_email. */
  beneficiaryEmail?: string | null;
}

/**
 * Creates one category-locked Tremendous reward per beneficiary and stores
 * the delivery record. Tremendous's recipient object requires an email
 * field regardless of delivery method (confirmed via their docs), but that
 * field is only actually used to send anything when delivery.method is
 * EMAIL — under LINK it's inert. So: use real EMAIL delivery when a
 * beneficiary email was captured at onboarding (fully automatic, no share
 * page needed); otherwise fall back to LINK with a deterministic
 * placeholder address, surfacing the claim URL on the public share page
 * instead — Failsafe doesn't require beneficiary contact info by design.
 */
export async function deliverGiftCards({
  challengeId,
  beneficiaries,
  experienceType,
  totalAmountCents,
  beneficiaryEmail,
}: DeliverGiftCardsInput): Promise<void> {
  const supabase = createServiceRoleClient();
  const productId = process.env[CATEGORY_PRODUCT_ENV[experienceType]];

  if (!isTremendousConfigured() || !productId) {
    await supabase.from("gift_card_deliveries").insert(
      beneficiaries.map((name, i) => ({
        challenge_id: challengeId,
        beneficiary_name: name,
        amount_cents: splitEvenly(totalAmountCents, beneficiaries.length)[i],
        experience_type: experienceType,
        status: "failed" as const,
      }))
    );
    return;
  }

  const amounts = splitEvenly(totalAmountCents, beneficiaries.length);

  const hasRealEmail = Boolean(beneficiaryEmail?.trim());

  await Promise.all(
    beneficiaries.map(async (name, i) => {
      const amountCents = amounts[i];
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
                value: { denomination: centsToWholeUnits(amountCents), currency_code: "SEK" },
                delivery: { method: hasRealEmail ? "EMAIL" : "LINK" },
                products: [productId],
                recipient: {
                  name,
                  email: hasRealEmail
                    ? beneficiaryEmail!.trim()
                    : `beneficiary+${challengeId}-${i}@noreply.failsafe.app`,
                },
              },
            ],
          }),
        });

        if (!res.ok) throw new Error(`Tremendous order failed: ${res.status}`);

        const data = (await res.json()) as {
          order?: { id?: string; rewards?: { id?: string; delivery?: { link?: string } }[] };
        };
        const reward = data.order?.rewards?.[0];

        await supabase.from("gift_card_deliveries").insert({
          challenge_id: challengeId,
          beneficiary_name: name,
          amount_cents: amountCents,
          experience_type: experienceType,
          tremendous_order_id: data.order?.id ?? null,
          tremendous_reward_id: reward?.id ?? null,
          claim_url: reward?.delivery?.link ?? null,
          status: "sent",
          delivered_at: new Date().toISOString(),
        });
      } catch {
        await supabase.from("gift_card_deliveries").insert({
          challenge_id: challengeId,
          beneficiary_name: name,
          amount_cents: amountCents,
          experience_type: experienceType,
          status: "failed",
        });
      }
    })
  );
}
