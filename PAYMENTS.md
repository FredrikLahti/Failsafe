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
shows both can be present; unclear which wins if they conflict).

## Verified against a live Tremendous sandbox account

Ran both delivery paths end to end against a real test-mode Tremendous
account (not just the documented spec): a failed challenge with
`beneficiary_email` set (EMAIL delivery) and one without (LINK delivery),
using real SEK-currency category-locked catalog products. Everything above
about `recipient.email` optionality and the `rewards` array shape held up
exactly as documented. New things learned that weren't obvious from the spec
alone:

- **"Category-locked" means picking a `category: "merchant_card"` catalog
  product, never `category: "visa_card"`.** Tremendous's own `category` field
  on a product isn't a semantic category like "restaurant" or "travel" — it's
  the payment-instrument type. `merchant_card` = single-brand gift card
  (`GET /products` returned entries like "Ticketmaster SE", "Ving SE",
  "McDonalds SE" — exactly the category-locked, can't-redirect-to-arbitrary-
  spending instruments this design needs); `visa_card` is their
  general-purpose flexible reward, the thing this design explicitly avoids.
  There's no separate "restaurant"/"travel"/"activity" taxonomy to query —
  product names/catalogs have to be read and matched to Kinwin's experience
  types by hand (or by keyword search), which is what was done to pick
  `TREMENDOUS_PRODUCT_*` values for this test.
- **Some catalog products only accept a fixed list of denominations, not a
  flexible range.** E.g. "Ving SE" only offers exactly `1000` or `1500` SEK
  (`skus: [{min:1000,max:1000},{min:1500,max:1500}]`), not a min-max range
  like most other products. `lib/tremendous.ts` sends whatever the computed
  per-beneficiary stake split is and doesn't validate it against the
  product's actual SKU list first — an order for a fixed-denomination product
  with a non-matching amount would fail at Tremendous and surface as the
  existing generic `status: "failed"` path, with no indication in the admin
  dashboard of *why*. Worth validating a product's SKU shape before setting
  it as a `TREMENDOUS_PRODUCT_*` value for real use, or checking `GET
  /products/{id}` before order creation.
- **The claim link is only ever returned in the `POST /orders` response** —
  confirmed by fetching the same order/reward back afterward via both `GET
  /orders/{id}` and `GET /rewards/{id}`: neither includes a `link` field
  under `delivery`, even moments after a successful LINK-delivery order.
  This means `lib/tremendous.ts` capturing `data.order.rewards[0].delivery
  .link` immediately from the creation response and persisting it to
  `gift_card_deliveries.claim_url` in the same request is the *only* way to
  ever get that link — if that Supabase insert failed after Tremendous had
  already executed the order (card charged, gift card created), there is
  currently no way to recover the claim link via the API. That's a real gap:
  worth either wrapping the insert with a retry, or treating "order created
  but insert failed" as a page-someone-immediately condition rather than a
  silently lost reward.
- The `recipient` object in responses always includes `email` and `phone`
  keys (defaulting to `""` when not supplied in the request), never omits
  them — doesn't change any behavior here, just don't expect `undefined`.
- Rewards carry an `expires_at` (~1 year out in this sandbox), which
  `gift_card_deliveries` doesn't currently store — there's no way today to
  know from Kinwin's own data whether a delivered gift card has lapsed
  unclaimed.
- The funding source used (`method: "balance"`, EUR) doesn't need to match
  the reward's currency (SEK) — Tremendous converts automatically at order
  time (order `payment.currency_code: "EUR"`, reward `value.currency_code:
  "SEK"`, real exchange rate applied even in sandbox; `fees: 0` in this
  account, which may not hold on every funding source/plan).
- The resulting claim URL (`https://reward.testflight.tremendous.com/...`) is
  a real, fully rendered Tremendous-hosted page: correct denomination,
  currency, and exact product name ("Global Experience Card SE gift card"),
  real terms of service referencing the actual underlying card issuer, and a
  redemption form that asks the beneficiary for their email at claim time —
  confirming the design intent that Kinwin itself never needs to collect
  beneficiary contact info for LINK delivery; Tremendous collects it, if at
  all, only at the point the beneficiary actually redeems. (Not actually
  redeemed during this test, to avoid consuming the sandbox reward or
  emailing a real address for no reason — page contents and linkage were
  enough to confirm it's genuine.)
- The public `/share/[token]` page correctly surfaces the exact same claim
  URL Tremendous returned, unmodified.

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

## Still not tested against a live ParityDeals account

Stripe (subscription checkout, off-session stake capture, webhooks) and
Tremendous (EMAIL and LINK gift-card delivery) have both now been exercised
against real test-mode accounts — see above. ParityDeals is the one
remaining unverified integration: no credentials for it have been available
in any environment this was built/tested in, so `fetchParityDealsPrice`'s
request/response shape is still a best-effort guess. It's currently
unreachable anyway since PPP pricing is disabled behind `PPP_PRICING_ENABLED`
in `lib/pricing.ts` (flat price for everyone until ParityDeals is configured
and verified — see that file). Everything is written to fail gracefully
(fall back to the flat price) when ParityDeals is unconfigured or wrong.

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
