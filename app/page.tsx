import Link from "next/link";
import { Button } from "@/components/ui";
import { WaxSeal } from "@/components/WaxSeal";
import { HABIT_CATEGORIES } from "@/lib/habits";
import { resolveLocalizedPrice } from "@/lib/pricing";

export default async function LandingPage() {
  // PPP/localized pricing is disabled for now (see PPP_PRICING_ENABLED in
  // lib/pricing.ts) — this always resolves to the flat base price. Once PPP
  // pricing is re-enabled, pass the visitor's country/IP back in here (see
  // git history for the x-vercel-ip-country / x-forwarded-for lookup this
  // used to do).
  const price = await resolveLocalizedPrice();

  return (
    <div className="flex-1 flex flex-col">
      <header className="max-w-5xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <span className="font-display text-xl tracking-wide">Kinwin</span>
        <nav className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm text-parchment/80 hover:text-parchment px-3 py-2"
          >
            Sign in
          </Link>
          <Link href="/sign-up">
            <Button>Get started</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-6 pt-12 pb-20 text-center">
          <div className="flex justify-center mb-8">
            <WaxSeal variant="gold" animate={false} size={72} />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl leading-[1.1] mb-6">
            Even if you fail,
            <br />
            your loved ones win.
          </h1>
          <p className="text-lg text-parchment/80 max-w-xl mx-auto mb-10">
            Build a habit. Fail, and you&rsquo;re funding a night out for
            someone you love, one you&rsquo;re banned from attending. Succeed,
            and you don&rsquo;t just save the money, you&rsquo;ve actually
            improved yourself.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up">
              <Button className="w-full sm:w-auto px-8 py-3.5 text-base">
                Start your challenge
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="ghost" className="w-full sm:w-auto px-8 py-3.5 text-base">
                How it works
              </Button>
            </a>
          </div>
        </section>

        <section id="how-it-works" className="bg-parchment text-ink py-20">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="font-display text-3xl text-center mb-14">How Kinwin works</h2>
            <div className="grid sm:grid-cols-3 gap-8">
              <HowItWorksCard
                step="1"
                title="Pick a habit"
                body="Choose from six proven categories. We suggest a minimal starting version, a realistic frequency, and an honest timeline — because most habits take weeks, not days."
              />
              <HowItWorksCard
                step="2"
                title="Choose a consequence"
                body="Pick people you care about and an experience that would actually sting to pay for: a trip, a nice dinner, a night out. If you fail, you treat them to it. You're just not allowed to be there."
              />
              <HowItWorksCard
                step="3"
                title="Check in weekly"
                body="A short weekly check-in keeps you honest. Reminders ease off automatically as your streak holds."
              />
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="font-display text-3xl text-center mb-4">Six habits to start with</h2>
            <p className="text-center text-parchment/70 mb-12">
              Each one comes with a realistic timeline based on how long it typically takes to stick.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {HABIT_CATEGORIES.map((category) => (
                <div
                  key={category.id}
                  className="border border-sage/40 rounded-lg p-5 bg-ink"
                >
                  <p className="font-display text-lg mb-1">{category.label}</p>
                  <p className="text-sm text-parchment/70">{category.tagline}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="max-w-md mx-auto px-6 text-center">
            <h2 className="font-display text-3xl mb-4">Pricing</h2>
            <p className="font-display text-4xl mb-2">
              {price.amountCents / 100} {price.currency}
              <span className="text-base text-parchment/60"> /month</span>
            </p>
            <p className="text-sm text-parchment/70">
              {price.discounted
                ? "Localized pricing applied for your region."
                : "Subscription required to run a challenge. Stakes are billed separately, only if you fail."}
            </p>
          </div>
        </section>

        <section className="bg-parchment text-ink py-20">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h2 className="font-display text-3xl mb-4">Ready to put something on the line?</h2>
            <p className="text-ash mb-8">
              Five minutes to set up. Then it&rsquo;s real.
            </p>
            <Link href="/sign-up">
              <Button className="px-8 py-3.5 text-base">Create your challenge</Button>
            </Link>
            <p className="text-xs text-ash mt-4">
              Once they know what they could get, trust us, they&rsquo;ll be paying attention.
            </p>
          </div>
        </section>
      </main>

      <footer className="max-w-5xl w-full mx-auto px-6 py-8 text-center text-xs text-ash">
        Kinwin: a habit-accountability app. Subscription-based, real stakes delivered as gift cards. We don&rsquo;t profit when you fail.
      </footer>
    </div>
  );
}

function HowItWorksCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-ember text-parchment font-mono flex items-center justify-center mx-auto mb-4">
        {step}
      </div>
      <h3 className="font-display text-xl mb-2">{title}</h3>
      <p className="text-sm text-ash">{body}</p>
    </div>
  );
}
