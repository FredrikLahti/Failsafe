# Payments, subscriptions, and gift-card delivery

This documents the actual implementation and where it deliberately deviates
from a literal "authorize on card, void or capture later" reading of the
spec, plus what's unverified without live Stripe/Tremendous/ParityDeals
credentials.

## Why there's no held authorization

Stripe (and the underlying card networks) release an uncaptured
authorization automatically — in practice within about a week, not the
3-20 weeks a Failsafe challenge runs. Holding a single PaymentIntent open
for the life of a challenge isn't something Stripe supports, so this
doesn't do that. Instead:

1. **Subscription checkout** (`/api/stripe/checkout`) collects the user's
   card via a Stripe Checkout subscription session. The webhook handler
   (`/api/webhooks/stripe`) saves the resulting card as the customer's
   default payment method.
2. **Challenge creation** (`reserveStake` in `lib/payments/stake.ts`) looks
   up that saved payment method and snapshots it against the challenge in
   `stake_payments` with `status = 'reserved'`. Nothing is charged.
3. **Success** (`releaseStake`) just marks the record `released` — there was
   never a hold to void.
4. **Failure** (`captureStake`) creates a fresh off-session `PaymentIntent`
   for the stake + flat fee and confirms it immediately. Success →
   `captured`, decline/error → `capture_failed`.

User-facing behavior matches the spec (nothing charged beyond the
subscription unless you fail); the mechanism is a saved card + a new charge,
not a held authorization.

## `capture_failed` is an internal-only state

A declined capture doesn't change what the user reported (`final_reports`
still says `failed_paid`), and it doesn't become a final-report choice. It's
visible only in `stake_payments.status` and reflected in the admin dashboard
as `Failed (capture declined)`. `challenges.status` gets flipped to the
pre-existing `completed_failure_unpaid` value for that admin visibility,
reusing a status value that used to be user-selectable and no longer is.

## Gift card delivery has no recipient contact info by design

Failsafe never collects a beneficiary's email or phone — the whole point is
that the user sends the invite themselves. Tremendous's Orders API is built
around a `recipient` object; every version of their docs referenced during
this implementation required an email on that object even when using `LINK`
delivery (a reward that produces a claim URL instead of an emailed reward).
**This wasn't verified against Tremendous's live API** — network access in
the environment this was built in couldn't reach `developers.tremendous.com`.
The current code sends a deterministic, never-checked placeholder address
(`beneficiary+<challengeId>-<n>@noreply.failsafe.app`) purely to satisfy that
field, and relies entirely on the `LINK` claim URL — stored in
`gift_card_deliveries.claim_url` and surfaced on `/share/[token]` — for
actual delivery. Confirm this against current Tremendous docs (or their
support) before processing real money through it.

Category-locking uses Tremendous's `products` array on the reward (specific
brand/product IDs, restricting choice away from their general-purpose
flexible/Visa reward). The actual product IDs are account- and
region-specific; `TREMENDOUS_PRODUCT_*` env vars are placeholders.

## ParityDeals and VPN detection are generic HTTP integrations, not SDKs

No specific VPN/proxy detection vendor was named. `lib/pricing.ts` calls a
configurable endpoint (`VPN_DETECTION_API_URL`/`_API_KEY`) and fails *open*
(treats the request as legitimate) when unconfigured — that's a deliberate
tradeoff to avoid blocking pricing entirely in environments without this set
up, not a security guarantee. Same caveat as Tremendous: the ParityDeals
request shape in `fetchParityDealsPrice` is a best-effort guess at a
plausible REST contract, not verified against their live API.

## Nothing here has been tested against a live Stripe/Tremendous/ParityDeals
account

No credentials for any of these services were available in the environment
this was built in. Everything is written to fail gracefully (skip the
feature, mark a delivery/capture as failed) when unconfigured, but the
happy-path request/response shapes for Tremendous and ParityDeals should be
confirmed against their current docs before this goes anywhere near real
money.
