import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/payments/stake";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { SubscribeButton } from "@/components/SubscribeButton";
import { SUBSCRIPTION_BASE_PRICE_CENTS_SEK } from "@/lib/stripe";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const subscribed = await hasActiveSubscription(user.id);

  if (!subscribed) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl sm:text-3xl mb-4">Subscribe to start</h1>
          <p className="text-parchment/70 mb-8">
            A Kinwin subscription ({SUBSCRIPTION_BASE_PRICE_CENTS_SEK / 100} SEK/month) is
            required to create a challenge — it&rsquo;s what keeps the stake mechanic running.
          </p>
          <SubscribeButton />
        </div>
      </div>
    );
  }

  return <OnboardingWizard />;
}
