-- Failsafe schema: profiles, challenges, recipients, checkins, final reports.
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users, created automatically on sign-up.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- challenges: the core habit + consequence commitment.
-- ---------------------------------------------------------------------------
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,

  category text not null check (
    category in (
      'exercise', 'diet', 'sleep', 'screen_time', 'saving', 'mindfulness'
    )
  ),
  difficulty_tier text not null check (difficulty_tier in ('easy', 'medium', 'complex')),
  habit_title text not null,
  frequency text not null,
  duration_weeks_min int not null,
  duration_weeks_max int not null,

  cue_situation text not null,
  cue_action text not null,

  consequence_description text not null,
  recipient_name text not null,

  start_date date not null default current_date,
  status text not null default 'active' check (
    status in ('active', 'completed_success', 'completed_failure_paid', 'completed_failure_unpaid')
  ),

  share_token text not null unique default encode(gen_random_bytes(9), 'base64'),
  reminder_cadence_days int not null default 7,
  last_reminder_at timestamptz,

  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- share_token from gen_random_bytes/base64 can contain '/', '+' which are
-- awkward in URLs; normalize to a URL-safe token on insert instead.
create or replace function public.generate_share_token()
returns text
language sql
as $$
  select translate(encode(gen_random_bytes(9), 'base64'), '+/=', '-_');
$$;

alter table public.challenges
  alter column share_token set default public.generate_share_token();

create index if not exists challenges_user_id_idx on public.challenges (user_id);
create index if not exists challenges_share_token_idx on public.challenges (share_token);

alter table public.challenges enable row level security;

create policy "challenges: owner full access" on public.challenges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- recipients: who benefits from the consequence if the challenge is failed.
-- ---------------------------------------------------------------------------
create table if not exists public.recipients (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  name text not null,
  invite_message text,
  created_at timestamptz not null default now()
);

create index if not exists recipients_challenge_id_idx on public.recipients (challenge_id);

alter table public.recipients enable row level security;

create policy "recipients: owner full access" on public.recipients
  for all using (
    exists (
      select 1 from public.challenges c
      where c.id = recipients.challenge_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.challenges c
      where c.id = recipients.challenge_id and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- checkins: weekly self-report.
-- ---------------------------------------------------------------------------
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  week_number int not null,
  status text not null check (status in ('good', 'partial', 'bad', 'missed')),
  note text,
  created_at timestamptz not null default now(),
  unique (challenge_id, week_number)
);

create index if not exists checkins_challenge_id_idx on public.checkins (challenge_id);

alter table public.checkins enable row level security;

create policy "checkins: owner full access" on public.checkins
  for all using (
    exists (
      select 1 from public.challenges c
      where c.id = checkins.challenge_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.challenges c
      where c.id = checkins.challenge_id and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- final_reports: the honest end-of-challenge report.
-- ---------------------------------------------------------------------------
create table if not exists public.final_reports (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null unique references public.challenges (id) on delete cascade,

  outcome text not null check (outcome in ('completed', 'failed_paid', 'failed_unpaid')),
  photo_url text,
  what_happened text,
  would_binding_payment_help boolean,
  would_pay_for_automated boolean,

  created_at timestamptz not null default now()
);

alter table public.final_reports enable row level security;

create policy "final_reports: owner full access" on public.final_reports
  for all using (
    exists (
      select 1 from public.challenges c
      where c.id = final_reports.challenge_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.challenges c
      where c.id = final_reports.challenge_id and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Public share view: only the columns needed for the recipient page,
-- reachable anonymously by share_token (no login required).
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
  c.consequence_description,
  c.recipient_name,
  c.start_date,
  c.status,
  c.completed_at,
  fr.outcome,
  fr.photo_url
from public.challenges c
left join public.final_reports fr on fr.challenge_id = c.id;

grant select on public.challenge_shares to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket for optional final-report photos.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('challenge-photos', 'challenge-photos', true)
on conflict (id) do nothing;

create policy "challenge-photos: public read" on storage.objects
  for select using (bucket_id = 'challenge-photos');

create policy "challenge-photos: owner upload" on storage.objects
  for insert with check (
    bucket_id = 'challenge-photos' and auth.uid() is not null
  );

create policy "challenge-photos: owner manage" on storage.objects
  for update using (
    bucket_id = 'challenge-photos' and owner = auth.uid()
  );

create policy "challenge-photos: owner delete" on storage.objects
  for delete using (
    bucket_id = 'challenge-photos' and owner = auth.uid()
  );
