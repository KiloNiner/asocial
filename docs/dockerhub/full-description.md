![asocial](https://raw.githubusercontent.com/KiloNiner/asocial/main/public/logo.svg)

**Gentle training wheels for keeping your friendships alive.**

asocial is a self-hosted, multi-user web app for people who find it hard to
remember — or find the energy — to stay in touch with friends. You enter your
friends, group them into circles with a contact rhythm, and asocial suggests
*when* to reach out and *what to do* (send a message, call, meet for coffee,
catch a movie, visit or host) — with deliberate randomness so it never feels
like you're acting off a script.

Source, issues and full documentation: [github.com/KiloNiner/asocial](https://github.com/KiloNiner/asocial)

## Quick start

```bash
docker run -d \
  --name asocial \
  -p 3000:3000 \
  -v asocial-data:/data \
  -e DATABASE_PATH=/data/asocial.db \
  -e APP_URL=http://localhost:3000 \
  -e CRON_SECRET=change-me \
  -e TZ=Europe/Copenhagen \
  kiloniner/asocial:latest
```

Or with Compose:

```yaml
services:
  asocial:
    image: kiloniner/asocial:latest
    ports:
      - "3000:3000"
    environment:
      DATABASE_PATH: /data/asocial.db
      APP_URL: http://localhost:3000
      CRON_SECRET: change-me
      TZ: Europe/Copenhagen
    volumes:
      - asocial-data:/data
    restart: unless-stopped

volumes:
  asocial-data:
```

Open `http://localhost:3000` — the register page creates the first
(admin) account. Registration after that is invite-only.

## Tags

- `latest` — most recent release
- `X.Y.Z` (e.g. `1.1.0`) — a specific pinned release

Images are multi-arch (`linux/amd64` + `linux/arm64`).

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_PATH` | SQLite file path (default `./dev.db`; use `/data/asocial.db` with the volume above) |
| `APP_URL` | Public URL; enables the Secure cookie flag and links in notifications |
| `CRON_SECRET` | Guards the manual job trigger `POST /api/cron/run` |
| `TZ` | Server timezone for the nightly scheduler run |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | Email digest delivery (leave `SMTP_HOST` empty to disable) |

Pushover credentials are per-user, entered in the app's Settings — not env vars.

The database lives entirely on the `asocial-data` volume. Back it up by
copying `/data/asocial.db`, or use the in-app JSON export/import in Settings.
Migrations run automatically on container start.

## Features

- **Friends & circles** — friends belong to one or more circles with a
  contact rhythm; a personal interval can override it, and circle-less
  friends fall back to a default.
- **Randomized scheduling** — every scheduled contact gets configurable
  jitter so the rhythm stays organic. A neglected friend gets one gentle
  nudge a few days out — never a spawned backlog of overdue tasks.
- **Activity suggestions** — weighted random pick across built-in and
  custom interaction types, tunable per friend, per circle, and globally.
- **Two views** — a Monday-first month calendar, and an action-window
  board: one row per friend, color-coded bands showing when to act.
- **Guilt-free by design** — no red overdue states, ever. Unlimited
  snoozing, and skipping just restarts the rhythm.
- **Journal** — every contact is logged, shown as a timeline per friend.
- **Birthdays** — automatic congratulation nudges, separate from the
  regular contact cadence.
- **Notifications** — a daily digest via Pushover and email, only when
  something is actually open.
- **Multi-user** — invite-only registration with strict per-user data
  isolation.
- **Six themes** (three light, three dark) plus Auto.
- **i18n** — English, Danish, Swedish and Klingon (tlhIngan Hol).

## Screenshots

![Action-window board](https://raw.githubusercontent.com/KiloNiner/asocial/main/docs/screenshots/dashboard-board.png)

![Calendar](https://raw.githubusercontent.com/KiloNiner/asocial/main/docs/screenshots/calendar.png)

![Friend detail](https://raw.githubusercontent.com/KiloNiner/asocial/main/docs/screenshots/friend-detail.png)

![Settings — theme selector](https://raw.githubusercontent.com/KiloNiner/asocial/main/docs/screenshots/settings-theme.png)

More screenshots (friends list, friend editing, circles, dark theme) are in
the [GitHub README](https://github.com/KiloNiner/asocial#screenshots).
