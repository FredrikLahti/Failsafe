import { SUBSCRIPTION_BASE_PRICE_CENTS_SEK } from "@/lib/stripe";

export interface LocalizedPrice {
  amountCents: number;
  currency: string;
  countryCode: string | null;
  discounted: boolean;
}

/**
 * Purchasing-power-parity pricing via ParityDeals. Exact request/response
 * shape is unverified against ParityDeals' live API in this environment
 * (network access here is restricted to an allowlist that didn't include
 * their docs) — confirm the endpoint and payload before relying on this in
 * production. Structured so that's a one-function swap.
 */
async function fetchParityDealsPrice(countryCode: string): Promise<number | null> {
  const apiKey = process.env.PARITYDEALS_API_KEY;
  const productId = process.env.PARITYDEALS_PRODUCT_ID;
  if (!apiKey || !productId) return null;

  try {
    const res = await fetch("https://api.paritydeals.com/api/v1/price", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: productId,
        country: countryCode,
        base_price_cents: SUBSCRIPTION_BASE_PRICE_CENTS_SEK,
        base_currency: "SEK",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { localized_price_cents?: number };
    return data.localized_price_cents ?? null;
  } catch {
    return null;
  }
}

/**
 * VPN/proxy detection to stop users from spoofing a low-income country to
 * get the discounted price. No vendor was specified, so this calls a
 * generically-configured HTTP check (VPN_DETECTION_API_URL/KEY) rather than
 * a specific SDK. Fails open (treats the request as "not a VPN") when
 * unconfigured, so pricing isn't silently blocked in environments without
 * this set up — that's a deliberate tradeoff, not a security guarantee.
 */
async function isLikelyVpnOrProxy(ipAddress: string): Promise<boolean> {
  const apiUrl = process.env.VPN_DETECTION_API_URL;
  const apiKey = process.env.VPN_DETECTION_API_KEY;
  if (!apiUrl || !apiKey || !ipAddress) return false;

  try {
    const res = await fetch(`${apiUrl}?ip=${encodeURIComponent(ipAddress)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { is_vpn?: boolean; is_proxy?: boolean };
    return Boolean(data.is_vpn || data.is_proxy);
  } catch {
    return false;
  }
}

/**
 * Resolves what a user in `countryCode` should pay for the subscription.
 * Falls back to the base SEK price whenever ParityDeals isn't configured,
 * the lookup fails, or the request looks like it's coming through a VPN/proxy.
 */
export async function resolveLocalizedPrice(
  countryCode: string | null,
  ipAddress: string | null
): Promise<LocalizedPrice> {
  const base: LocalizedPrice = {
    amountCents: SUBSCRIPTION_BASE_PRICE_CENTS_SEK,
    currency: "SEK",
    countryCode,
    discounted: false,
  };

  if (!countryCode) return base;

  const suspicious = await isLikelyVpnOrProxy(ipAddress ?? "");
  if (suspicious) return base;

  const localizedCents = await fetchParityDealsPrice(countryCode);
  if (localizedCents == null || localizedCents >= base.amountCents) return base;

  return {
    amountCents: localizedCents,
    currency: "SEK",
    countryCode,
    discounted: true,
  };
}
