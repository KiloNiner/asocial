# asocial

**Gentle training wheels for keeping your friendships alive.**

asocial is a self-hosted, multi-user web app for people who find it hard to
remember — or find the energy — to stay in touch with friends. You enter your
friends, group them into circles with a contact rhythm, and asocial suggests
*when* to reach out and *what to do* (send a message, call, meet for coffee,
catch a movie, visit or host) — with deliberate randomness so it never feels
like you're acting off a script.

## Features

- **Friends & circles** — friends belong to one or more circles ("Close
  friends: every ~2 weeks", "Old classmates: every ~2 months"). A friend in
  several circles follows the most frequent one; a personal interval can
  override; circle-less friends fall back to your default.
- **Randomized scheduling** — every scheduled contact gets ±25% jitter
  (configurable) so the rhythm stays organic. Overdue backlogs are never
  spawned; a neglected friend gets one gentle nudge a few days out.
- **Activity suggestions** — weighted random pick across built-in and custom
  interaction types, never the same type twice in a row. Weights are tunable
  at three levels: per friend ("never suggest visits — she lives far away"),
  per circle ("board game group leans toward hosting"), and globally.
  Completing with a *different* activity than suggested is one click.
- **Two views** — a classic Monday-first month calendar, and an
  action-window board: one row per friend, a color-coded band showing the
  days in which to act, sorted by urgency.
- **Guilt-free by design** — no red overdue states, ever. Lingering
  suggestions turn a soft amber ("still open"), snoozing is unlimited, and
  skipping just restarts the rhythm.
- **Journal** — every contact is logged with what you talked about, shown as
  a timeline per friend.
- **Birthdays** — day + month (year optional). Birthdays appear in both
  views, and a congratulation nudge is scheduled automatically (Feb 29
  birthdays are celebrated Feb 28 in non-leap years). Congratulating someone
  does not postpone the next real catch-up.
- **Notifications** — daily digest via [Pushover](https://pushover.net) and
  email at your chosen hour, only when something is actually open. Lingering
  tasks re-appear only every third day (anti-nag rule).
- **Multi-user** — invite-only registration (first user becomes admin) with
  strict per-user data isolation.
- **i18n** — English and Danish, Monday week start, 24h time.

## Quick start (development)

```bash
npm install
npm run seed          # applies migrations + demo data (skip for empty start)
npm run dev
```

Open http://localhost:3000 — with seed data, log in as
`karsten@example.com` / `demo-password-1` (or `mette@example.com` /
`demo-password-2`). On an empty database the register page creates the
first (admin) account.

## Deployment (Docker)

```bash
cp .env.example .env   # edit: APP_URL, CRON_SECRET, SMTP_* for email digests
docker compose up -d           # builds locally
# or pull the prebuilt multi-arch image (amd64/arm64):
docker compose pull && docker compose up -d
```

The SQLite database lives on the `asocial-data` volume (`/data/asocial.db`).
Backup = copy that file (or `sqlite3 /data/asocial.db ".backup backup.db"`), or
use the in-app JSON backup/restore in Settings.
Migrations run automatically at container start.

### Container images

Published to Docker Hub as **`kiloniner/asocial`** (`:latest` plus each version
tag, e.g. `:1.0.0`) by the `.github/workflows/docker-publish.yml` GitHub Action.
It builds `linux/amd64` + `linux/arm64` on every `v*.*.*` git tag (and on manual
dispatch). Publishing requires two repo secrets: `DOCKERHUB_USERNAME` and a
`DOCKERHUB_TOKEN` access token.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_PATH` | SQLite file path (default `./dev.db`, container: `/data/asocial.db`) |
| `APP_URL` | Public URL; enables Secure cookies and links in notifications |
| `CRON_SECRET` | Guards the manual job trigger `POST /api/cron/run` |
| `TZ` | Server timezone for the nightly scheduler run |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | Email digest delivery (leave `SMTP_HOST` empty to disable) |
| `FAKE_TODAY` | Test-only: freeze the scheduler's notion of today (`YYYY-MM-DD`) |

Pushover credentials are per-user, entered in Settings — not env vars.

## How scheduling works

A daily job (04:30 server time, plus a catch-up on boot) ensures every
active friend has a pending contact suggestion. When you complete one, the
next is scheduled from the completion date: effective interval (friend
override → most frequent circle → your default) ± jitter, with a weighted
random activity suggestion. The action window (default 7 days) is when you
should act — before it opens the band is muted, inside it it's vivid, after
it it softens to amber but never screams.

The hourly notification job sends each user's digest at their chosen local
hour through their enabled channels, deduplicated per day.

## QA / time travel

The standard verification loop:

```bash
npm run seed -- --reset
FAKE_TODAY=2026-07-07 npm run dev
# trigger jobs manually:
curl -X POST -H "x-cron-token: $CRON_SECRET" \
  "http://localhost:3000/api/cron/run?job=scheduler&force=1"
curl -X POST -H "x-cron-token: $CRON_SECRET" \
  "http://localhost:3000/api/cron/run?job=digest&force=1"
```

Bump `FAKE_TODAY`, restart, re-run the jobs, and watch windows shift,
birthday tasks appear, and digests fire. `GET /api/health` reports the last
scheduler run. Unit tests: `npm test`.

## Stack

Next.js (App Router) · TypeScript · SQLite via Drizzle ORM · Tailwind CSS ·
next-intl (en/da) · Croner for in-process cron · argon2id auth with opaque
session tokens. Single container, no external services required.
