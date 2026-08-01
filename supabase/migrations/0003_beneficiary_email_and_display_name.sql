-- Follow-up to 0002: an optional beneficiary contact email (used to switch
-- Tremendous delivery from LINK to EMAIL when available), and wiring up
-- profiles.display_name (collected at sign-up) so the beneficiary Memory
-- Lane message can say who the promise was for.

-- ---------------------------------------------------------------------------
-- Optional shared contact email for the beneficiaries named on a challenge.
-- Never required — Failsafe still works entirely through the share link
-- when this is left blank.
-- ---------------------------------------------------------------------------
alter table public.challenges
  add column if not exists beneficiary_email text;

-- ---------------------------------------------------------------------------
-- Populate profiles.display_name from the auth user's metadata (set at
-- sign-up, see app/sign-up/page.tsx) instead of leaving it null forever.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Expose the challenge owner's display name on the public share view so the
-- beneficiary upload prompt can say "for {name}" instead of a placeholder.
-- This is not new exposure beyond what the owner already told the
-- beneficiary themselves (they sent this link personally).
-- ---------------------------------------------------------------------------
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
  p.display_name as owner_display_name
from public.challenges c
left join public.final_reports fr on fr.challenge_id = c.id
left join public.profiles p on p.id = c.user_id;

grant select on public.challenge_shares to anon, authenticated;
