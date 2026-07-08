# Changelog

## v1.0.0

First complete release of **asocial** — a self-hosted, multi-user web app that
helps you keep friendships alive with randomized, guilt-free "reach out" nudges.

### Core
- Friends grouped into circles with per-circle contact rhythms; per-friend
  interval override; circle-less friends fall back to a user default.
- Randomized scheduler (±jitter) so cadence never feels scripted; weighted
  random activity suggestions (message, call, coffee, activity, visit, host)
  with no back-to-back repeats and per-friend / per-circle / global weights.
- Journal of logged interactions per friend; optional birthdays (year
  optional) with automatic congratulation nudges (Feb 29 → Feb 28 in
  non-leap years).
- Two views: Monday-first month calendar and a gantt-style action-window
  board sorted by urgency.
- Guilt-free design: no red overdue states, unlimited snooze, skip restarts
  the rhythm.
- First contact suggestion is created immediately when an autoscheduled
  friend is added.

### Accounts & data
- Invite-only multi-user auth (first user is admin); argon2id passwords,
  opaque session cookies; strict per-user data isolation.
- JSON backup & restore of circles, friends, journal, custom interaction
  types and activity preferences (replace-all restore).

### Notifications
- Daily digest via Pushover and email at a per-user hour, with an anti-nag
  rule (lingering tasks re-appear only every third day).

### Platform
- Localized UI in English, Danish, Swedish and Klingon (tlhIngan Hol);
  Monday weeks, 24h time.
- Six themes (Paper, Catppuccin Latte, Rosé Pine Dawn, Catppuccin Mocha,
  Tokyo Night, Rosé Pine) plus Auto (follows the OS), via semantic color
  tokens.
- Single Docker container; in-process nightly scheduler and hourly digest
  jobs; SQLite via Drizzle with migrations applied at boot.
- CI publishes multi-arch images (`linux/amd64` + `linux/arm64`) to Docker
  Hub as `kiloniner/asocial` on each version tag.
