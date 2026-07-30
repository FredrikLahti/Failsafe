# Failsafe

Even if you fail, your loved ones win.

Failsafe is a habit-accountability app: build a habit, and put a real
consequence behind it — an experience you pay for on someone else's behalf if
you fail, one you don't get to attend yourself. No paid reward, no automatic
emails to third parties, no payment processing in this version.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres, Auth, Storage) via `@supabase/ssr`

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` in the Supabase SQL editor (or via
   `supabase db push`). It creates the `profiles`, `challenges`,
   `recipients`, `checkins`, and `final_reports` tables, a `profiles` row
   trigger on sign-up, the public `challenge_shares` view used by the
   no-login recipient page, and a `challenge-photos` storage bucket for
   optional final-report photos.
3. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project
     Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — used only server-side by the admin
     dashboard to read across all users.
   - `ADMIN_DASHBOARD_PASSWORD` — shared password gating `/admin`.
   - `NEXT_PUBLIC_SITE_URL` — used to build shareable challenge links.
4. `npm install`
5. `npm run dev` and open http://localhost:3000

## App map

- `/` — landing page
- `/sign-up`, `/sign-in` — Supabase email/password auth
- `/onboarding` — habit + consequence setup wizard, ends with a shareable
  letter-style invitation for the recipient
- `/dashboard` — streak, week progress, milestones, check-in / finish links
- `/checkin` — weekly good/partial/bad check-in
- `/report` → `/report/result/[id]` — final honest report and the letter-motif
  result screen (gold on success, ember on failure)
- `/share/[token]` — public, no-login recipient page
- `/admin` (behind `/admin/login`) — password-protected list of all
  participants and their status

## Notes

- There is no payment processing and no automatic email to recipients — the
  onboarding flow generates a message the user copies and sends themselves.
- The admin dashboard uses the Supabase service-role key server-side only; it
  is never sent to the browser.
