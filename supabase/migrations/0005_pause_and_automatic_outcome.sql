-- Pause feature + automatic outcome calculation.
--
-- challenges.status gains 'paused'. challenge_pauses logs each pause period
-- (started_at/ended_at/reason) for history; challenges.paused_at marks an
-- in-progress pause (null when not paused) and challenges.paused_days_total
-- accumulates the exact days of every *completed* pause. Week numbering and
-- the automatic end-of-challenge evaluation both subtract paused days from
-- elapsed time (see lib/pause.ts, lib/streak.ts, lib/challenge-lifecycle.ts)
-- so pausing freezes the clock rather than costing or skipping any week.

alter table public.challenges drop constraint if exists challenges_status_check;
alter table public.challenges add constraint challenges_status_check
  check (status in ('active', 'paused', 'completed_success', 'completed_failure_paid', 'completed_failure_unpaid'));

alter table public.challenges
  add column if not exists paused_at timestamptz,
  add column if not exists paused_days_total int not null default 0;

create table if not exists public.challenge_pauses (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists challenge_pauses_challenge_id_idx on public.challenge_pauses (challenge_id);

alter table public.challenge_pauses enable row level security;

create policy "challenge_pauses: owner full access" on public.challenge_pauses
  for all using (
    exists (
      select 1 from public.challenges c
      where c.id = challenge_pauses.challenge_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.challenges c
      where c.id = challenge_pauses.challenge_id and c.user_id = auth.uid()
    )
  );

-- Extend the public share view with the pause fields needed to render the
-- extended timeline on /share/[token]. CREATE OR REPLACE VIEW can only
-- append columns at the end of the existing list, not insert them in the
-- middle — so the new columns go after owner_display_name, not grouped
-- next to the other duration fields.
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
  c.paused_days_total
from public.challenges c
left join public.final_reports fr on fr.challenge_id = c.id
left join public.profiles p on p.id = c.user_id;

grant select on public.challenge_shares to anon, authenticated;
