-- Track the Tremendous reward's expiry date (rewards carry an expires_at,
-- roughly a year out, confirmed against a live sandbox order) so the public
-- share page can tell the beneficiary their gift card claim has a deadline.
-- Previously discarded entirely — see PAYMENTS.md.

alter table public.gift_card_deliveries
  add column if not exists expires_at timestamptz;

create or replace view public.gift_card_delivery_shares
with (security_invoker = off)
as
select
  gcd.challenge_id,
  gcd.beneficiary_name,
  gcd.claim_url,
  gcd.expires_at
from public.gift_card_deliveries gcd
where gcd.status = 'sent';

grant select on public.gift_card_delivery_shares to anon, authenticated;
