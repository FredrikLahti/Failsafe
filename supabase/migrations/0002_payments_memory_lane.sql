-- Failsafe schema additions: Stripe subscription + stake tracking, Tremendous
-- gift-card delivery, and Memory Lane photo support.
--
-- Payment model note: a Stripe card authorization cannot be held open for
-- the 3-20 week span of a challenge (issuers/Stripe release uncaptured
-- holds after ~7 days). So instead of "authorize at creation, void or
-- capture at resolution" on a single PaymentIntent, this schema tracks a
-- saved payment method (via SetupIntent) at creation time and creates a
-- fresh off-session PaymentIntent only if the challenge is failed. Nothing
-- is charged beyond the subscription unless that capture happens.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Stripe customer id lives on the profile (one customer per user).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists stripe_customer_id text;

-- ---------------------------------------------------------------------------
-- subscriptions: Stripe Billing subscription state, one per user.
-- Written only by server-side webhook/service-role code, never directly by
-- the client — RLS below only grants read access to the owner.
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  status text not null check (
    status in ('incomplete', 'active', 'past_due', 'canceled', 'trialing')
  ),
  currency text not null default 'sek',
  base_price_cents int not null default 9900,
  -- Localized/PPP-adjusted price actually being charged, if different from
  -- base_price_cents (see lib/pricing.ts for the ParityDeals integration
  -- point that resolves this at checkout time).
  localized_price_cents int,
  country_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "subscriptions: read own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- stake_payments: one row per challenge, tracking the saved payment method
-- and the capture/void outcome. Read-only to the owner; all writes go
-- through server actions/webhooks using the service-role client.
-- ---------------------------------------------------------------------------
create table if not exists public.stake_payments (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null unique references public.challenges (id) on delete cascade,

  amount_cents int not null,
  currency text not null default 'sek',
  -- Flat fee (10-15 SEK) added on top of the stake at capture time to cover
  -- Stripe + Tremendous processing costs. Null until captured.
  fee_cents int,

  stripe_setup_intent_id text,
  stripe_payment_method_id text,
  stripe_payment_intent_id text,

  status text not null default 'pending_card' check (
    status in (
      'pending_card',     -- challenge created, card not yet saved
      'reserved',         -- card on file, challenge active, nothing charged
      'released',         -- challenge succeeded — no charge, nothing to do
      'captured',         -- challenge failed — charge succeeded
      'capture_failed'    -- charge attempt failed (e.g. decline); admin-only, not user-facing
    )
  ),

  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stake_payments_challenge_id_idx on public.stake_payments (challenge_id);

alter table public.stake_payments enable row level security;

create policy "stake_payments: owner read" on public.stake_payments
  for select using (
    exists (
      select 1 from public.challenges c
      where c.id = stake_payments.challenge_id and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- gift_card_deliveries: one row per beneficiary per challenge, tracking the
-- Tremendous order used to deliver the category-locked gift card.
-- ---------------------------------------------------------------------------
create table if not exists public.gift_card_deliveries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,

  beneficiary_name text not null,
  amount_cents int not null,
  experience_type text not null check (
    experience_type in ('dinner', 'tickets_event', 'trip', 'activity', 'other')
  ),

  tremendous_order_id text,
  tremendous_reward_id text,
  -- The Tremendous LINK-delivery claim URL, surfaced on the public share
  -- page so the beneficiary can redeem it there (Failsafe never collects
  -- beneficiary emails, so there's no other channel to deliver it through).
  claim_url text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  delivered_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists gift_card_deliveries_challenge_id_idx on public.gift_card_deliveries (challenge_id);

alter table public.gift_card_deliveries enable row level security;

create policy "gift_card_deliveries: owner read" on public.gift_card_deliveries
  for select using (
    exists (
      select 1 from public.challenges c
      where c.id = gift_card_deliveries.challenge_id and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Rename estimated_cost_cents -> stake_amount_cents. This field used to be
-- an explicitly private budgeting reference ("never shown to anyone else,
-- never charged"); it is now the literal amount authorized/captured, so it
-- needs a name (and UI copy, see app/onboarding/page.tsx) that reflects that.
-- ---------------------------------------------------------------------------
alter table public.challenges
  rename column estimated_cost_cents to stake_amount_cents;

comment on column public.challenges.stake_amount_cents is
  'The real stake: saved as a payment method at creation, captured only if the challenge fails. No longer a private-only reference.';

-- ---------------------------------------------------------------------------
-- Memory Lane: photo_type distinguishes a self-submitted success photo from
-- a beneficiary-submitted failure photo on the same final_reports row.
-- ---------------------------------------------------------------------------
alter table public.final_reports
  add column if not exists photo_type text check (photo_type in ('self', 'beneficiary'));

-- The two "did the user avoid paying" survey questions are obsolete now
-- that capture is automatic — drop them along with failed_unpaid as a
-- selectable outcome (still allowed at the DB level for admin correction,
-- just no longer written by the final-report form).
alter table public.final_reports
  drop column if exists would_binding_payment_help,
  drop column if exists would_pay_for_automated;

-- ---------------------------------------------------------------------------
-- Allow the public share page to attach a beneficiary photo without
-- requiring auth. This is done through a server action using the
-- service-role client (which already bypasses RLS, like the admin
-- dashboard), gated on: challenge.share_token matches, challenge.status is
-- 'completed_failure_paid', and no photo has been attached yet — see
-- app/share/[token]/actions.ts. No anon RLS write policy is added here on
-- purpose: validating "is this share_token allowed to write, and has the
-- gift card actually been delivered" is business logic that belongs in the
-- server action, not in a blanket RLS predicate that anyone with a
-- share_token could otherwise satisfy.
--
-- The storage bucket's existing "owner upload"/"owner manage" policies are
-- unaffected; beneficiary uploads go through the service-role client and
-- bypass storage RLS the same way the admin dashboard queries do.
-- ---------------------------------------------------------------------------

-- Extend the public challenge_shares view with the fields Memory Lane and
-- the beneficiary upload flow need (photo_type, duration for captions).
create or replace view public.challenge_shares
with (security_invoker = off)
as
select
  c.id,
  c.share_token,
  c.category,
  c.habit_title,
  c.frequency,
  c.difficulty_tier,
  c.duration_weeks_min,
  c.duration_weeks_max,
  c.beneficiaries,
  c.experience_type,
  c.experience_description,
  c.start_date,
  c.status,
  c.completed_at,
  fr.outcome,
  fr.photo_url,
  fr.photo_type
from public.challenges c
left join public.final_reports fr on fr.challenge_id = c.id;

grant select on public.challenge_shares to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public view of delivered (only) gift card claim links, keyed by
-- challenge_id, so the share page can show the beneficiary their claim link
-- without exposing pending/failed delivery state or amounts to the public.
-- ---------------------------------------------------------------------------
create or replace view public.gift_card_delivery_shares
with (security_invoker = off)
as
select
  gcd.challenge_id,
  gcd.beneficiary_name,
  gcd.claim_url
from public.gift_card_deliveries gcd
where gcd.status = 'sent';

grant select on public.gift_card_delivery_shares to anon, authenticated;
