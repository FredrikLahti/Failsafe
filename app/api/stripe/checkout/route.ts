import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { resolveLocalizedPrice } from "@/lib/pricing";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing isn't configured yet — set STRIPE_SECRET_KEY." },
      { status: 503 }
    );
  }

  // PPP/localized pricing is disabled for now (see PPP_PRICING_ENABLED in
  // lib/pricing.ts) — everyone gets the flat base price. Once re-enabled,
  // pass the visitor's country/IP back in here (see git history for the
  // x-vercel-ip-country / x-forwarded-for lookup this used to do).
  const price = await resolveLocalizedPrice();

  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: price.currency.toLowerCase(),
          unit_amount: price.amountCents,
          recurring: { interval: "month" },
          product_data: { name: "Kinwin subscription" },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/onboarding?subscribed=1`,
    cancel_url: `${siteUrl}/dashboard`,
    metadata: {
      user_id: user.id,
      country_code: price.countryCode ?? "",
      localized: String(price.discounted),
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
