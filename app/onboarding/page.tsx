import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/payments/stake";
import { AppNav } from "@/components/AppNav";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { SubscribeButton } from "@/components/SubscribeButton";
import { SubscriptionConfirming } from "@/components/SubscriptionConfirming";
import { SUBSCRIPTION_BASE_PRICE_CENTS_SEK } from "@/lib/stripe";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const subscribed = await hasActiveSubscription(user.id);

  if (!subscribed) {
    const { subscribed: justSubscribed } = await searchParams;

    // Redirected straight back from a successful Stripe Checkout — the
    // webhook that flips `subscriptions.status` to active hasn't
    // necessarily landed yet (it fires asynchronously from Stripe, not as
    // part of the redirect). Poll briefly instead of showing the
    // "subscribe first" gate the user just paid to get past.
    if (justSubscribed === "1") {
      return (
        <div className="flex-1 flex flex-col">
          <AppNav email={user.email} />
          <SubscriptionConfirming />
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col">
        <AppNav email={user.email} />
        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="max-w-sm text-center">
            <h1 className="font-display text-2xl sm:text-3xl mb-4">Subscribe to start</h1>
            <p className="text-parchment/70 mb-8">
              Kinwin costs {SUBSCRIPTION_BASE_PRICE_CENTS_SEK / 100} SEK/month.
            </p>
            <SubscribeButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <AppNav email={user.email} />
      <OnboardingWizard />
    </div>
  );
}
