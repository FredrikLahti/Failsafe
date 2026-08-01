import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { SubscriptionStatus } from "@/lib/types/database";

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    default:
      return "incomplete";
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!isStripeConfigured() || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const customerId =
        typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null);

      if (!userId || !customerId || !subscriptionId) break;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
      if (profileError) {
        console.error(
          `[webhook] checkout.session.completed: failed to save stripe_customer_id for user ${userId}:`,
          profileError.message
        );
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
      }

      const { error: subscriptionError } = await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: "active",
          country_code: session.metadata?.country_code || null,
        },
        { onConflict: "user_id" }
      );
      if (subscriptionError) {
        console.error(
          `[webhook] checkout.session.completed: failed to upsert subscription for user ${userId}:`,
          subscriptionError.message
        );
        return NextResponse.json({ error: "Failed to record subscription" }, { status: 500 });
      }

      // Make the card used at checkout the customer's default payment
      // method, so per-challenge stake reservation has something to find.
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const paymentMethod = subscription.default_payment_method;
      const paymentMethodId =
        typeof paymentMethod === "string" ? paymentMethod : (paymentMethod?.id ?? null);
      if (paymentMethodId) {
        try {
          await stripe.customers.update(customerId, {
            invoice_settings: { default_payment_method: paymentMethodId },
          });
        } catch (err) {
          console.error(
            `[webhook] checkout.session.completed: failed to set default payment method for customer ${customerId}:`,
            err instanceof Error ? err.message : err
          );
          return NextResponse.json({ error: "Failed to set default payment method" }, { status: 500 });
        }
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: mapStripeStatus(subscription.status),
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);
      if (error) {
        console.error(
          `[webhook] ${event.type}: failed to update subscription ${subscription.id}:`,
          error.message
        );
        return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
