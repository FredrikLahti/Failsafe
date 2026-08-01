import { NextResponse } from "next/server";
import { headers } from "next/headers";
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

  const hdrs = await headers();
  const countryCode = hdrs.get("x-vercel-ip-country");
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const price = await resolveLocalizedPrice(countryCode, ip);

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
      country_code: countryCode ?? "",
      localized: String(price.discounted),
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
