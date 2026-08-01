-- Optional shared beneficiary phone number, mirroring beneficiary_email
-- (migration 0003). Enables Tremendous PHONE (SMS) gift-card delivery —
-- see lib/tremendous.ts, which prefers PHONE over EMAIL over LINK when
-- multiple contact methods are on file (SMS is the more universally
-- available option per user feedback).

alter table public.challenges
  add column if not exists beneficiary_phone text;
