# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**asocial** — a self-hosted, multi-user web app that helps people maintain friendships by scheduling randomized "reach out" nudges. Next.js 16 (App Router) + TypeScript + SQLite (Drizzle) + Tailwind v4 + next-intl. Ships as a single Docker container; no external services required. See `README.md` for the feature list and deploy instructions.

> Repo docs describe functional behavior only. Do not add motivation/backstory about *why* the app exists.

## Commands

```bash
npm run dev                  # dev server (localhost:3000)
npm run build                # production build (standalone output)
npm test                     # vitest run (all unit tests)
npm run test:watch           # vitest watch
npx vitest run tests/unit/scheduler.test.ts       # single test file
npx vitest run -t "jitteredInterval"              # single test by name
npx tsc --noEmit             # typecheck (do this before committing)
npm run lint                 # eslint
npm run seed                 # apply migrations + deterministic demo data
npm run seed -- --reset      # delete the db file first, then reseed
npm run db:generate          # generate a migration after editing src/db/schema.ts
```

Demo logins after seeding: `karsten@example.com` / `demo-password-1` (admin), `mette@example.com` / `demo-password-2`.

## Verification workflow (important)

There are no e2e tests in the repo. Unit tests cover only the pure scheduler/digest logic. **For anything with a runtime surface, verify by driving the real app** with `playwright-core` (preinstalled at `/opt/pw-browsers/chromium`) — the standard pattern used throughout this project's history is a throwaway `.cjs` script that logs in and asserts on `page.textContent`/screenshots. Use `FAKE_TODAY` to make scheduler behavior deterministic (see below).

Gotchas that have bitten this project:
- **Stale CSS after editing `globals.css` or the theme tokens**: `rm -rf .next` and restart the dev server, or the browser serves the old compiled CSS.
- **Never delete `dev.db` while the dev server is running** — it holds the old inode and writes silently vanish. Stop the server first (`pkill -f "next dev"`), then reseed.
- Background the dev server with the harness background mechanism, not shell `&` (which gets interrupted here).
- **Turbopack dev route-discovery glitch**: right after `rm -rf .next` + a fresh `next dev`, the *first* request to a nested dynamic route (e.g. `friends/[id]/edit`) can 404 even though the file is correct. Retrying, or `touch`-ing the route file, resolves it — not a real bug.
- **For screenshots or anything visual you'll show off**: use a production server (`npm run build && npm run start`), not `next dev` — dev mode overlays the Next.js DevTools badge on every page. Also explicitly pick a theme via the Settings UI first rather than relying on the default `auto` theme — it didn't reliably follow Playwright's `colorScheme` emulation in this environment.

## Architecture

### The scheduler is the core (`src/lib/scheduler/`)
Everything else is CRUD around it. It is deliberately split into **pure functions** (unit-tested, no DB) and a thin DB layer:
- `clock.ts` — `today(tz)`; the **only** place `FAKE_TODAY` is read. All scheduler logic takes `today` as a parameter so it's testable. Set `FAKE_TODAY=YYYY-MM-DD` to freeze time for QA.
- `interval.ts` — effective interval resolution: **friend override → most-frequent (min-interval) circle → user default**. This precedence order is mirrored by the activity picker.
- `jitter.ts` — ±jitter% randomization; injectable `rng` for deterministic tests.
- `activity-picker.ts` — weighted random contact-type pick. Weight resolution is the **same precedence**: friend pref → governing circle pref → user pref → type default. Never repeats the last-used type; `congratulate` (weight 0) is birthday-only and never enters rotation.
- `schedule.ts` — `scheduleNextTask()`: composes the above and inserts a task; clamps so it never spawns already-overdue tasks (lands 1–3 days out instead).
- `daily-job.ts` — the sweep: contact catch-up for friends missing a pending task + birthday tasks within 7 days. Idempotent via the `job_runs` UNIQUE(job, run_date) lock.

Calendar-level dates are **strings** (`YYYY-MM-DD`) manipulated by `dates.ts` (`addDays`/`daysBetween`) to stay DST-immune. Timestamps are epoch-ms integers.

### Per-user data isolation (`src/lib/db/queries.ts`)
This is a hard convention: **all reads/writes for user data go through `queries.ts`**, every function takes `userId` and filters by it. UI code and server actions should not import `db` directly — only `queries.ts` and the scheduler do. Keeping `db.select`/`db.insert` out of components/actions is what makes the isolation grep-auditable. Follow this when adding features. In practice a handful of actions (`settings.ts`, `tasks.ts`, `interactions.ts`) and the invites admin page still call `db` directly — always scoped by `userId` or an ownership check first, so isolation isn't actually broken, but new code should go through `queries.ts` rather than add to that list.

### Mutations = server actions; reads = RSC
All writes are `"use server"` actions in `src/actions/*` (zod-validated). Three route handlers exist: `POST /api/cron/run?job=scheduler|digest[&force=1]` (guarded by `x-cron-token: $CRON_SECRET`, for manual/test triggering), `GET /api/health`, and `GET /api/backup` (session-guarded, streams the current user's JSON export). Reads happen in server components via `queries.ts`.

### Background jobs run in-process (`src/instrumentation.ts` → `src/lib/cron.ts`)
`instrumentation.ts` runs DB migrations at boot, then Croner registers the daily scheduler (04:30) and hourly digest dispatch (`:05`) inside the `next start` process — so they fire without web traffic. A **boot catch-up** runs the scheduler immediately if it hasn't run today (survives a container that was off at 04:30). Migrations are applied here, not by a separate entrypoint.

### Notifications (`src/lib/notifications/`)
A channel registry (`dispatch.ts`) with pluggable `NotificationChannel` implementations (`channels/pushover.ts`, `channels/email.ts`). `digest.ts` is pure (unit-tested): it decides what goes in a digest, including the **anti-nag rule** — a lingering task re-appears only every 3rd day. Dedupe is per user/channel/local-day via `notification_log`. Cron-driven sends translate outside request scope via `digestTranslator` in `messages.ts`.

### Backup & restore (`src/lib/db/queries.ts`, `src/actions/backup.ts`)
`exportUserData`/`importUserData` cover circles, friends, journal, custom contact types and activity preferences — **not** `tasks` (regenerated) or account/session/notification data. Restore is replace-all in a transaction, preserving IDs, then calls `sweepUserContactTasks` (also used by the daily job) to regenerate pending suggestions.

### Operational logging
Console logging follows a `[tag] message: JSON` convention (`[boot]`, `[cron]`, `[cron:manual]`, `[digest]`, `[auth]`, `[health]`) so `docker logs` shows scheduled-job completions (with stats + duration), notification send failures, and login attempts without querying the DB. Login logging masks the client IP (last IPv4 octet zeroed / IPv6 collapsed to `/64`) before it's ever logged — keep that when touching `src/actions/auth.ts`.

### Auth (`src/lib/auth/`)
Roll-your-own: argon2id passwords, opaque session token in an httpOnly cookie with only `sha256(token)` stored in DB. Invite-only — the first registered user becomes admin (`isBootstrap()`), everyone else needs a one-time invite. `getCurrentUser()` is the base lookup (`User | null`); `requireUserOrRedirect()` / `requireUser()` / `requireAdmin()` build on it, but they are **not interchangeable** — a throw that crosses a Server Component or Server Action boundary is logged by Next as a server error even for the routine "not logged in" case, so the one you call depends on where:
- **Page/layout Server Components** call `requireUserOrRedirect()`, which redirects to `/login` instead of throwing. The `(app)` route-group layout already guards every page under it this way, but each page repeats the check (defense in depth) rather than trusting the layout blindly.
- **Server actions** never call `requireUser()`/`requireAdmin()` directly — those still throw and are only for contexts that catch them. Instead, actions call `getCurrentUser()` themselves and return early with a typed `{ error: "unauthorized" }` (or `return;`/`return null;` for void/no-op actions) when it's null. `common.errors.unauthorized`, `tasks.errors.unauthorized` and `backup.errors.unauthorized` exist for the namespaces that translate `state.error` directly; others fall back to displaying the raw code, which is fine since this path is a rare race (session expiring mid-page), not normal flow.

Password reset is admin-driven, not email-driven (SMTP is optional in this app): `password-resets.ts` mirrors the invite-token pattern (hashed, single-use, 24h TTL) — an admin mints a link on the invites admin page and relays it out of band; redeeming it at `/reset-password` calls `destroySessionsForUser` so old sessions don't survive the change.

### i18n (`src/i18n/`, `messages/*.json`)
Locales: `en`, `da`, `sv`, `tlh` (Klingon). Routing is `/[locale]/…`. **All four message files must keep key parity** — add a key to `en.json` and the others too. Monday-first weeks, 24h time. `sv` has full CLDR; `tlh` falls back to English date formatting (no OS ships Klingon locale data). Adding a locale means: `routing.ts`, a message file, the `messagesByLocale` map in `notifications/messages.ts`, and the `userSettings.locale` enum + profile `<select>`.

### Theming (`src/app/globals.css`, `src/lib/themes.ts`)
Components use **semantic color tokens** (`bg-surface`, `text-ink`, `bg-accent`, `bg-field`, `text-warn`, `bg-birthday-soft`, …) — never hardcoded `stone-*`/`teal-*` palette classes. A theme is just a set of `--t-*` values in `globals.css`. Six themes (3 light, 3 dark) plus `auto` (follows `prefers-color-scheme` via `:root:not([data-theme])`). The `[locale]/layout.tsx` stamps `data-theme` server-side (user setting → cookie → auto) so there's no flash. Circle colors (user data hex) and emoji are intentionally exempt from tokens. `--t-field`/`--t-field-border` exist specifically so inputs stay visually recessed from cards in dark themes — use `inputClass` from `components/ui/classes.ts` for all form fields.

## Database changes
Edit `src/db/schema.ts`, then `npm run db:generate`. SQLite enum changes (Drizzle `text({enum})`) produce **no SQL** — they're TS-only, so no migration is generated for them (expected). Migrations run automatically at boot and via the seed script. `job_runs` is a lock table (UNIQUE job+run_date); `contact_types` with `user_id NULL` are the seeded built-ins (i18n-keyed labels), non-null are per-user custom types.

## Design principle: guilt-free
No red "overdue" states, ever. Lingering tasks soften to amber (`warn`), snoozing is unlimited, skipping just restarts the rhythm, and the digest anti-nag rule avoids daily repetition. Preserve this when touching task states or notification copy.

## Git
Commits land directly on `main`; commit messages are milestone-scoped with a body explaining the change. Releases are tagged `vX.Y.Z` with a matching `CHANGELOG.md` entry and a `package.json`/`package-lock.json` version bump. Follow strict [semantic versioning](https://semver.org/) for the version number: PATCH for backwards-compatible bug fixes only, MINOR for backwards-compatible feature additions, MAJOR for breaking changes (schema/API/config changes that require user action). Don't default to a MINOR bump just because a release bundles several fixes.
