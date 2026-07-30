# Failsafe

Even if you fail, your loved ones win.

Failsafe is a habit-accountability app: build a habit, and put a real
consequence behind it. If you fail, you'll treat the people you name to an
experience — you just won't be there. No paid reward, no automatic emails to
third parties, no payment processing in this version.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres, Auth, Storage) via `@supabase/ssr`

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` in the Supabase SQL editor (or via
   `supabase db push`). It creates the `profiles`, `challenges`, `checkins`,
   and `final_reports` tables (challenges hold the consequence as
   `beneficiaries` + `experience_type`/`experience_description`, with a
   private `estimated_cost_cents` for the user's own reference only), a
   `profiles` row trigger on sign-up, the public `challenge_shares` view used
   by the no-login share page, and a `challenge-photos` storage bucket for
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
- `/onboarding` — habit + consequence setup wizard (beneficiaries, experience
  type/description, an internal estimated-cost reference, and a soft
  self-check nudge), ends with a shareable letter-style invitation
- `/dashboard` — streak, week progress, milestones, check-in / finish links
- `/checkin` — weekly good/partial/bad check-in
- `/report` → `/report/result/[id]` — final honest report and the letter-motif
  result screen (gold on success, ember on failure)
- `/share/[token]` — public, no-login page for the beneficiaries
- `/admin` (behind `/admin/login`) — password-protected list of all
  participants and their status

## PWA

- `app/manifest.ts` generates `/manifest.webmanifest` (name, icons, and
  `theme_color`/`background_color` matching the `--ink`/`--parchment` design
  tokens, `display: standalone`). Icons live in `public/icons/`.
- `public/sw.js` is a basic service worker (network-first for navigations
  with an `/offline.html` fallback, cache-first for static assets), registered
  client-side in production by `components/ServiceWorkerRegistration.tsx`.
- `components/AddToHomeScreenPrompt.tsx` shows a dismissible install prompt
  after onboarding (invite page) and on the dashboard — Share → Add to Home
  Screen instructions on iOS Safari, a real install button on Android Chrome
  via `beforeinstallprompt`. It stays hidden once installed or dismissed
  (tracked in `localStorage`).

## Notes

- There is no payment processing and no automatic email to the people named
  as beneficiaries — the onboarding flow generates a message the user copies
  and sends themselves.
- The consequence is never framed as a direct money transfer: the estimated
  cost is a private budgeting reference for the user and is never shown on
  the invite letter, the public share page, or the final report — only the
  experience and who's included are.
- The admin dashboard uses the Supabase service-role key server-side only; it
  is never sent to the browser.
