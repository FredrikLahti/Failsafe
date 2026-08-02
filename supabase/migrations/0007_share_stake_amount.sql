-- Exposes the stake amount on the public share view so beneficiaries can
-- see what's actually on the line (stake transparency), not just the
-- experience description. CREATE OR REPLACE VIEW can only append columns
-- at the end of the existing list, not insert them in the middle — so this
-- goes after paused_days_total, matching the pattern from migration 0005.
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
  fr.photo_type,
  p.display_name as owner_display_name,
  c.paused_at,
  c.paused_days_total,
  c.stake_amount_cents
from public.challenges c
left join public.final_reports fr on fr.challenge_id = c.id
left join public.profiles p on p.id = c.user_id;

grant select on public.challenge_shares to anon, authenticated;
