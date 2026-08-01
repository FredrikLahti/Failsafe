# Payments, subscriptions, and gift-card delivery

This documents the actual implementation and where it deliberately deviates
from a literal "authorize on card, void or capture later" reading of the
spec, plus what's unverified without live Stripe/Tremendous/ParityDeals
credentials.

## Why there's no held authorization

Stripe (and the underlying card networks) release an uncaptured
authorization automatically — in practice within about a week, not the
3-20 weeks a Kinwin challenge runs. Holding a single PaymentIntent open
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

## Gift card delivery: LINK by default, EMAIL when we have an address

Kinwin doesn't require a beneficiary's email or phone by design — the
whole point is that the user sends the invite themselves.

**Verified directly against Tremendous's API Blueprint spec
(`tremendous-rewards/api-docs`) and their openapi-generated Node client
(`tremendous-rewards/tremendous-node`)** — `developers.tremendous.com`
itself is blocked by this environment's egress policy, but their docs are
also published as source on GitHub, which isn't:

- `recipient.email` is **optional** — only `recipient.name` is required.
  Email only matters as the address `EMAIL` delivery sends to; under `LINK`
  it isn't needed at all. (An earlier pass had this backwards — assumed
  email was required unconditionally and sent a placeholder
  `noreply@kinwin.app`-style address under LINK delivery for no reason.
  Fixed: LINK requests now send `recipient: { name }` with no email.)
- The request body's `rewards` array (not a singular `reward`) is the
  current/preferred shape — confirmed in the spec, which documents `reward`
  only as legacy backwards-compatibility.
- The response's claim URL path — `order.rewards[].delivery.link` — is
  confirmed against the Node client's generated types
  (`CreateOrder200ResponseOrderRewardsInnerDelivery.link`), matching what
  `lib/tremendous.ts` already parsed.
- Sandbox base URL `https://testflight.tremendous.com/api/v2` and
  production `https://www.tremendous.com/api/v2` are both confirmed.

Given that, `lib/tremendous.ts` does:

- **No beneficiary email on file** (the default): `delivery.method: "LINK"`,
  `recipient: { name }` only. The claim URL Tremendous returns is stored in
  `gift_card_deliveries.claim_url` and surfaced on `/share/[token]`.
- **Beneficiary email provided at onboarding** (optional field —
  `challenges.beneficiary_email`): `delivery.method: "EMAIL"` with that real
  address, so Tremendous sends the reward directly. Fully automatic, no
  reliance on the beneficiary visiting the share page.

One simplification stands: the email field is a single optional contact for
the whole challenge, not one per beneficiary (beneficiaries are often a
household — "Mom, Grandma and Aunt Clara" — sharing one inbox is a
reasonable default). A true per-beneficiary contact list wasn't built; it'd
need a small redesign of the beneficiaries input from a comma-separated
string to a repeatable name+email list.

Still not verified: `campaign_id` interaction with `products` (the spec
shows both can be present; unclear which wins if they conflict), and this
still hasn't been run against a live sandbox account — the fixes above are
confirmed against the documented contract, not exercised end-to-end.

## ParityDeals and VPN detection are generic HTTP integrations, not SDKs

No specific VPN/proxy detection vendor was named. `lib/pricing.ts` calls a
configurable endpoint (`VPN_DETECTION_API_URL`/`_API_KEY`) and fails *open*
(treats the request as legitimate) when unconfigured — that's a deliberate
tradeoff to avoid blocking pricing entirely in environments without this set
up, not a security guarantee. Unlike Tremendous, ParityDeals doesn't publish
an open-source spec/client to verify against the same way, so the request
shape in `fetchParityDealsPrice` remains a best-effort guess, not verified.

## Webhook and stake-write failures are no longer silent

An earlier pass had the webhook handler and `lib/payments/stake.ts` ignoring
Supabase write errors (`const { data } = await supabase...`, `error`
discarded). This actually happened during testing: the payments migrations
(`0002`, `0003`) hadn't been applied to the target database yet, every write
in `checkout.session.completed` failed, and the handler still returned `200
{ received: true }` — Stripe considered the webhook delivered, the
subscription silently never activated, and nothing in the logs said why.

Fixed: every Supabase call in `app/api/webhooks/stripe/route.ts` and
`lib/payments/stake.ts` now checks its `error` and `console.error`s it with
enough context (challenge/user/subscription id) to find the row. The webhook
handler additionally returns HTTP 500 on a DB write failure instead of 200 —
Stripe's retry logic (exponential backoff, several attempts over ~3 days)
then does the right thing on a transient failure instead of the event being
marked delivered and dropped. If you see `[webhook]` or `[stake]` errors in
the server log, that's real: something (usually a schema mismatch) is
preventing state from being recorded, even though Stripe itself may have
succeeded.

## Still not tested against a live Stripe/Tremendous/ParityDeals account

No credentials for any of these services were available in the environment
this was built in. Everything is written to fail gracefully (skip the
feature, mark a delivery/capture as failed) when unconfigured. Tremendous's
request/response shape is now verified against their published spec (above);
Stripe's calls use the official SDK so its shape is trustworthy by
construction; ParityDeals remains unverified.

## AI agents and Stripe Checkout: test mode only, never delegated end to end

Stripe Checkout now shows an "I am an AI agent acting on behalf of someone
else" disclosure checkbox. During test-mode QA of this payment flow, an AI
agent (Claude Code) drove Checkout end to end — filling card details and
submitting — including once completing a live 3D Secure challenge. That
checkbox's underlying element couldn't be reliably interacted with by the
agent's browser tooling in that pass, so whether it ended up checked is
unconfirmed.

That's an acceptable gap for exploratory testing against a **test-mode**
Stripe account with test cards, where nothing real is charged and no real
cardholder is involved. It is not acceptable for any checkout against the
**live/production** Stripe account: an AI agent must not carry a real
checkout through to the final submit/pay step on a human's behalf. For real
transactions, an agent may prepare the checkout (start the session, fill in
non-sensitive fields) but a human must review and click the final
payment/subscribe action themselves — the same boundary this project already
applies to entering payment details or submitting forms per its operating
rules.

## Display name

`profiles.display_name` is now populated at sign-up (a required "Your name"
field, passed through as Supabase auth user metadata and picked up by the
`handle_new_user` trigger). It's used only to personalize the beneficiary
Memory Lane prompt on `/share/[token]` ("Please immortalize this for
{name}..."); accounts created before this change will have `display_name =
null` and the message just drops the "for {name}" clause rather than
showing a placeholder.
