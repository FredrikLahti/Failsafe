# Failsafe

When you fail, your loved ones win.

Failsafe is a habit-accountability app: build a habit, and put a real stake
behind it. Subscribe monthly to run challenges; at each challenge's creation
you set a stake amount that's saved against your card on file (nothing
charged up front). Succeed and nothing is ever charged. Fail, and that stake
is captured and delivered to the people you named as a category-locked gift
card — you just aren't there for it.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres, Auth, Storage) via `@supabase/ssr`
- Stripe Billing (subscription) + off-session PaymentIntents (stake capture)
- Tremendous (category-locked gift card delivery)
- ParityDeals-style PPP pricing + VPN/proxy detection (both optional/pluggable)

## Setup

1. Create a Supabase project.
2. Run the migrations in `supabase/migrations/` in order (0001, 0002, 0003)
   in the Supabase SQL editor (or via `supabase db push`). Together they
   create `profiles`, `challenges`, `checkins`, `final_reports`,
   `subscriptions`, `stake_payments`, and `gift_card_deliveries`; the public
   `challenge_shares` and `gift_card_delivery_shares` views used by the
   no-login share page; the `challenge-photos` storage bucket (final report
   self-photos and beneficiary Memory Lane photos); an optional
   `challenges.beneficiary_email`; and a `handle_new_user` trigger update
   that populates `profiles.display_name` from sign-up.
3. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project
     Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — used server-side by the admin dashboard
     and by payment/webhook code paths that need to bypass RLS.
   - `ADMIN_DASHBOARD_PASSWORD` — shared password gating `/admin`.
   - `NEXT_PUBLIC_SITE_URL` — used to build shareable challenge links.
   - `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — subscription billing and
     stake capture. Without these, `/onboarding` shows a "subscribe first"
     gate that can't be completed.
   - `PARITYDEALS_API_KEY` / `PARITYDEALS_PRODUCT_ID` — optional; the base
     SEK price is used when unset.
   - `VPN_DETECTION_API_URL` / `VPN_DETECTION_API_KEY` — optional; PPP
     discounting is skipped (not blocked) when unset.
   - `TREMENDOUS_API_KEY` / `TREMENDOUS_FUNDING_SOURCE_ID` /
     `TREMENDOUS_PRODUCT_*` — gift card delivery on failure. Without these,
     failed challenges still capture the stake but gift card delivery
     records itself as failed for admin follow-up.
4. `npm install`
5. `npm run dev` and open http://localhost:3000

See `PAYMENTS.md` for how the stake/capture/delivery model actually works
and what's unverified pending real Stripe/Tremendous credentials.

## App map

- `/` — landing page, with a pricing section showing the (optionally
  PPP-localized) subscription price
- `/sign-up`, `/sign-in` — Supabase email/password auth
- `/onboarding` — gated behind an active subscription (`SubscribeButton` →
  Stripe Checkout if not); habit + consequence setup wizard (beneficiaries,
  experience type/description, the real stake amount, a soft self-check
  nudge), ends with a shareable letter-style invitation
- `/dashboard` — streak, week progress, milestones, check-in / finish links
- `/dashboard/memory-lane` — gallery of completed challenges with a photo
  (gold frame on success, ember on failure)
- `/checkin` — weekly good/partial/bad check-in
- `/report` → `/report/result/[id]` — final honest report (completed, or
  failed-and-charged — capture is automatic now) and the letter-motif result
  screen, with buttons back into onboarding for the next challenge
- `/share/[token]` — public, no-login page for the beneficiaries; on failure,
  shows the Tremendous claim link(s) and an upload prompt for their own
  Memory Lane photo
- `/admin` (behind `/admin/login`) — password-protected list of all
  participants, status, and stake/capture state
- `/api/stripe/checkout`, `/api/webhooks/stripe` — subscription checkout and
  Stripe webhook handling (customer/subscription sync, default payment
  method)

## PWA

- `app/manifest.ts` generates `/manifest.webmanifest` (name, icons, and
  `theme_color`/`background_color` matching the `--ink`/`--parchment` design
  tokens, `display: standalone`). Icons live in `public/icons/`.
- `public/sw.js` is a basic service worker (network-first for navigations
  with an `/offline.html` fallback, cache-first for static assets), registered
  client-side in production by `components/ServiceWorkerRegistration.tsx`.
- `components/AddToHomeScreenPrompt.tsx` shows a dismissible install prompt
  after onboarding (invite page) and on the dashboard — Share → Add to Home
  Screen instructions on iOS Safari, a real install button on Android Chrome
  via `beforeinstallprompt`. It stays hidden once installed or dismissed
  (tracked in `localStorage`).

## Notes

- There's still no automatic email to the people named as beneficiaries — the
  onboarding flow generates a message the user copies and sends themselves.
  Gift card delivery reuses that same channel: Tremendous issues a claim
  *link* rather than emailing the beneficiary directly, surfaced on the
  public share page the user already sent them.
- A card authorization can't be held open for a 3-20 week challenge (Stripe
  releases uncaptured holds after ~7 days), so the stake isn't a live
  hold — it's a saved payment method (from subscription checkout), charged
  off-session only if the challenge fails. See `PAYMENTS.md`.
- The admin dashboard uses the Supabase service-role key server-side only; it
  is never sent to the browser. Payment/webhook/gift-card code paths use the
  same service-role client, since `stake_payments`, `subscriptions`, and
  `gift_card_deliveries` are read-only to their owner via RLS.
