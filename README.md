# Proctored Online Examination Platform

A reusable, proctored online examination platform — not tied to any single exam. Handles
question authoring from PDFs, bulk student onboarding via Excel, browser-based proctoring,
and automatic evaluation with ranks and a leaderboard.

**Built by Shivansh Shekhar Ojha.**

## Roles

- **Super Admin** — bootstrapped once via a seed script. Creates/deactivates Admin accounts.
- **Admin** — created by the Super Admin. Authors exams, imports rosters, monitors attempts,
  evaluates, and publishes results.
- **Student** — created in bulk by an Admin. Forced to change password on first login. Takes
  the proctored exam.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres + Auth + Storage), Row-Level Security on every table
- `pdfjs-dist` for question-paper parsing, `xlsx` for roster import, `exceljs` for result export
- Resend for transactional email
- MediaPipe Face Detection + native browser APIs for proctoring

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then in the SQL editor run the
migrations in order:

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_roster_email_status.sql
supabase/migrations/0003_fix_multi_exam_student_rls.sql
```

(Or use the Supabase CLI: `supabase link` then `supabase db push`.)

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` —
  from Supabase → Project Settings → API.
- `RESEND_API_KEY` / `EMAIL_FROM` — **optional.** From [resend.com](https://resend.com), with a
  verified sending domain, if you want credential emails sent automatically. If you skip this
  entirely, account creation still works fine — every generated password is shown directly in
  the Admin/Super Admin UI (export to Excel or copy-paste), so you can email or WhatsApp
  credentials yourself instead of configuring an email provider at all.
- `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` / `SUPER_ADMIN_NAME` — used once by the seed
  script below.
- `APP_SECRET` — any random 32+ byte string.

### 4. Seed the Super Admin

```bash
npm run seed:super-admin
```

Safe to re-run — it's a no-op if a Super Admin already exists.

### 5. Run it

```bash
npm run dev
```

Sign in at `/login` with the Super Admin credentials to create your first Admin.

## APIs you'll need

- **Supabase** (free tier is enough to start) — Postgres, Auth, and Storage all come from
  one project.
- **Resend** — optional. Without it, accounts are still created normally and every generated
  password appears in the Admin/Super Admin UI (with an Excel export and a copy-to-clipboard
  button) so you can send credentials yourself by any means you like. Configure Resend later
  if/when you want that step automated.

## What to provide before this goes live

1. **A Supabase project** — URL + anon key + service role key (Project Settings → API).
2. **Real Super Admin credentials** — the email/password you want bootstrapped as the
   platform owner (`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` / `SUPER_ADMIN_NAME`).
3. **The production URL** once you know it (Vercel gives you one, or your custom domain) —
   goes into `NEXT_PUBLIC_APP_URL` and into Supabase's Auth redirect allow-list (step below).
4. *(Optional)* **A Resend account with a verified sending domain**, only if you want
   credential emails sent automatically instead of exporting/copying them from the UI yourself.
5. A decision on the two things this build is explicit about *not* solving: whether you need a
   true lockdown browser for high-stakes runs, and whether the in-memory rate limiter (fine for
   a single small deployment) needs upgrading to Upstash/Vercel KV for your expected traffic.

Everything else (schema, RLS, all app code) is already done — these are the only blanks left.

## Testing checklist

There's no automated test suite yet (not asked for) — here's the manual pass to run once real
Supabase/Resend credentials are in place:

1. `npm run seed:super-admin`, then sign in as Super Admin at `/login`.
2. Create an Admin from the Super Admin dashboard — the credentials appear directly on screen
   (copy them, or check your inbox if Resend is configured), sign in as that Admin.
3. As Admin: create an exam, upload a real question-paper PDF (+ answer key), verify the parsed
   draft looks reasonable, deliberately fix a wrong answer/option in the review step, save.
4. Import a small Excel roster (3–5 rows, columns `name`/`email`/`roll_no`) — confirm accounts
   are created and every password shows in the "new passwords" table with an Excel export;
   try "Reset password" on one row and confirm a fresh password appears the same way.
5. As a Student: sign in with an issued password, confirm the forced password-change screen
   appears and can't be skipped, then land on the dashboard.
6. Run the pre-exam check (camera permission, fullscreen), start the exam: confirm autosave
   (reload mid-exam and answers persist), the palette states update, and submit works.
7. Deliberately trigger proctoring: switch tabs, exit fullscreen, cover the camera — confirm
   events show up in the Admin's live monitor with a snapshot, and that violation counts
   increase; if `auto_submit_on_violation` is on, confirm it actually auto-submits past the
   configured limit.
8. As Admin: run "Evaluate now", grade a subjective answer if the exam has one, publish
   results, confirm the Student now sees rank/marks, and the Excel/print exports look right.
9. Try to access another Admin's exam or another Student's attempt by guessing a URL — should
   404/403, confirming RLS is doing its job.

## Deploying (Vercel + Supabase)

1. **Supabase**: run the migrations (above) against your project. In Authentication → URL
   Configuration, set the Site URL and add your production domain (and `localhost:3000` for
   local dev) to the redirect allow-list — this is what makes the forgot-password email link
   land back on `/reset-password` instead of being rejected.
2. **Vercel**: import this repo, set every variable from `.env.example` in Project Settings →
   Environment Variables (use the real Supabase/Resend values, not the placeholders), then
   deploy.
3. Run `npm run seed:super-admin` once **locally** against the production Supabase project
   (point `.env.local` at it temporarily) — there's no seed button in the UI by design, since
   it's a one-time bootstrap.
4. If you configured Resend, re-check its domain verification (SPF/DKIM records) against the
   domain in `EMAIL_FROM` — the #1 reason credential emails don't arrive. If you didn't
   configure it, that's fine — every password still shows up in the UI to export/copy.
5. Walk through the testing checklist above once against the deployed URL before handing it to
   real students.

## Security notes

- Every table has RLS; students can never read `correct_answer` — the one place that needs
  cross-user access (fetching questions to take the exam) verifies attempt ownership first via
  the normal RLS-scoped session, then reads through the service-role client, never trusting a
  student session with row access to `questions` at all.
- Passwords for Admin/Student accounts are generated with Node's `crypto.randomInt` (not
  `Math.random`), and Supabase Auth stores them hashed — nothing here re-implements password
  hashing.
- Sign-in and password-reset are rate-limited by Supabase Auth itself (GoTrue's built-in
  per-IP/email limits). The exam-facing endpoints (`/api/attempts/*`) have an additional
  in-memory rate limit — good enough for a single small deployment, but it resets per
  server instance, so treat it as a soft guard, not a hard guarantee, at real scale.
- `npm audit` currently flags the `xlsx` (SheetJS) package (no upstream fix yet — accepted
  risk since only Admins upload roster files) and a handful of Next.js 14 CVEs that are only
  fixed in Next 16 (a breaking major-version upgrade, intentionally not done automatically).

## Known, deliberate limitations

- **Browser proctoring is not a lockdown browser.** It logs tab switches, fullscreen exits,
  and camera anomalies for human review — it cannot physically prevent a second device or a
  determined cheater. For high-stakes exams, pair this with a dedicated lockdown/SEB solution.
- **PDF question parsing is heuristic.** Every parsed question, option, and answer must be
  reviewed and corrected by the admin before saving — nothing from the parser is ever
  auto-published.
- **PDF result export** is a print-friendly page (`/print/exams/[id]/results`) meant to be
  saved via the browser's print dialog; Excel export is a first-class downloadable `.xlsx`.

## Project layout

- `supabase/migrations/` — schema + RLS policies
- `scripts/seed-super-admin.ts` — one-time bootstrap
- `src/app/super-admin`, `src/app/admin`, `src/app/student` — role dashboards
- `src/app/exam-session` — the locked-down pre-check + exam-taking flow (deliberately outside
  the student dashboard's nav chrome)
- `src/lib/grading.ts` — server-side auto-grading and rank/percentile computation
- `src/lib/pdf-parse.ts` — PDF → draft question heuristics
- `src/hooks/use-proctoring.ts` — client-side proctoring signals
