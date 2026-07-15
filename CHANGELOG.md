# Changelog

## v1.6.0

### Added
- The notification digest email is now a branded HTML template instead
  of a bare unstyled list: a header with the asocial mark, each
  suggestion as an icon and sentence with a "tomorrow" tag where
  relevant, and a proper button-styled link back to the app. Readable
  in both light and dark mail clients. Plain-text and Pushover
  messages are unaffected by this change.
- Pushover notifications now use rich text: each suggestion line is
  bold, with a dimmed "tomorrow" tag instead of a plain trailing dash.

### Platform
- New `SMTP_TLS_REJECT_UNAUTHORIZED` env var: set to `false` to accept
  a self-signed cert (e.g. a local Proton Mail Bridge or Mailhog
  container) while keeping STARTTLS encryption on. Default behavior
  for real mail providers is unchanged.

## v1.5.1

### Security
- Backup restore now validates every field's value, not just its shape --
  a hand-edited backup file could previously set out-of-range values (a
  non-hex circle color, an out-of-bounds interval/weight, an invalid
  birthday) that the rest of the app assumes are pre-validated. Restore
  now enforces the same per-field bounds as the normal create/update forms.

### Fixed
- Custom activity types no longer accept arbitrary text in the emoji
  field -- it's validated as a real single emoji (skin-tone modifiers,
  family/role ZWJ sequences, flags, and keycaps all still work) on both
  creation and backup restore. The field can also now be left blank, for
  an activity type with no icon.

## v1.5.0

### Added
- asocial is now licensed under AGPL-3.0-or-later (`LICENSE`,
  `package.json`, README).
- The About page shows the project's license alongside the existing
  version/build/source links.
- Mobile nav is now a burger menu. Previously every page link plus the
  account row rendered inline as a top bar on small screens, growing
  taller as more links were added. A burger button next to the logo now
  reveals a dropdown panel with the page list, display name, and log
  out; closes on link click, tapping outside, or Escape. Desktop's
  sidebar is unchanged.

### Fixed
- Corrected two About-page manual entries that had drifted from actual
  behavior: notifications also cover a heads-up for tasks due tomorrow,
  and backup/restore now regenerates ids on every restore (so a backup
  drops cleanly into any account, but old bookmarked friend/circle
  links stop working after a restore).

### Changed
- Admin now appears above About in the sidebar nav (previously below
  it).

## v1.4.1

### Security
- Backup restore no longer trusts primary keys from the uploaded file.
  A hand-edited backup could previously set arbitrary, low-entropy ids
  (e.g. "1", "circle-1") as live database keys, since nothing validated
  id format or entropy on restore. Every circle, friend, custom contact
  type, and journal entry now gets a fresh server-generated id on every
  restore, with every reference remapped to match.
- Exported backup files no longer include internal userId values on
  each record — they were already discarded on restore, so this only
  affects what's inside the downloaded file itself.

### Fixed
- Restoring one account's backup into a different account on the same
  instance previously failed with a database error, since ids were
  preserved from the file and collided with the source account's
  still-live rows. Fixed by the same change above.

### Changed
- Because ids are now regenerated on every restore, a previously
  bookmarked or saved `/friends/<id>` or `/circles/<id>` link will no
  longer resolve after your next restore — including a plain restore
  of your own unmodified export. This applies going forward only.

## v1.4.0

### Security
- Fixed a cross-tenant data exposure bug in backup restore: a crafted
  backup file could pair your own friend or circle with another
  account's real friend/circle id (if you had somehow obtained one),
  surfacing that account's circle name and color on your own friends
  list, or corrupting which circle governs their contact schedule.
  Restore now verifies every cross-reference in the uploaded file
  actually belongs to the importing account before inserting it, with
  the same ownership check added to several read paths as defense in
  depth.

### Added
- Admins can now remove used or expired invites from the Admin page —
  previously only open, unredeemed invites had a way to be cleared,
  so the list only ever grew.

### Platform
- Registration — including accepting an invite — now logs a
  `[auth] registration succeeded` line (with role and masked IP),
  matching the existing login success/failure logging. Previously this
  was the only auth event invisible in `docker logs`.

## v1.3.1

### Fixed
- Any text input, select or textarea rendered at 14px, under iOS Safari's
  16px auto-zoom-on-focus threshold. Since the login/register/reset-password
  forms navigate away on submit instead of blurring, the zoom never reset,
  leaving the whole app zoomed in after logging in on an iPhone/iPad. All
  form fields now render at 16px.
- Logging in redirected to whatever locale the login page's URL happened to
  be in, ignoring the account's saved language. A user who changed their
  language in Settings on one browser would still see the old language
  after logging in on a different browser or device. Login now honors the
  account's saved locale; manually navigating to a different locale's URL
  afterward still works as before.

## v1.3.0

### Added
- An in-app About page (`/about`) showing the running version, build
  commit and date, and links back to the GitHub repo, changelog and
  Docker Hub image.
- An in-app manual on the About page covering circles, scheduling,
  activity suggestions, the two views, the guilt-free philosophy,
  journal, birthdays, notifications, backup/restore, themes, locales
  and accounts — fully translated in English, Danish and Swedish
  (Klingon keeps its usual lighter treatment).

### Changed
- The invites admin page is now a general Admin page (`/admin`, moved
  from `/admin/invites`) with distinct "Users" and "Invites" sections,
  reflecting that it already covered password resets alongside invites.

### Fixed
- The app icon (favicons, apple-touch-icon, Android/maskable icons) was
  visibly off-center on iOS/Android home screens; the mark is now
  correctly centered and every derived icon regenerated.
- "Not logged in" during a page visit or server action is no longer
  logged as a server error with a stack trace — auth behavior is
  unchanged, only how routine unauthenticated access is signaled.

### Platform
- Docker images now bake in the git commit and build date (`GIT_SHA`,
  `BUILD_DATE`), shown on the About page; local builds fall back to a
  "development build" label.
- Refreshed the README/docs screenshot gallery to match the current UI.

## v1.2.0

### Added
- Admin-driven password reset: an admin can mint a one-time reset link for
  any user from the invites admin page and relay it out of band — no SMTP
  required. Redeeming it signs the account out everywhere.
- A proper brand identity: favicon/PWA icon set, and the asocial mark now
  appears in the sidebar and on the login, register and reset-password
  pages (readable in both light and dark themes).

### Platform
- The README now includes a screenshot gallery of the app's major views.

## v1.1.0

### Fixed
- The action-window board no longer draws a full-width highlight band for
  tasks due far in the future.
- Changing your language in Settings now actually navigates to the new
  locale instead of silently staying on the old one.
- Logging a contact well before a pending nudge's window now resolves the
  stale task and reschedules from the real contact date, instead of leaving
  it stuck on the old due date.
- A friend's first auto-scheduled suggestion now lands within the action
  window instead of a full interval away.

### Changed
- Activity preferences on the friend edit page now sit above the "suggest
  contact automatically" checkbox instead of in a separate section below
  the form.

### Platform
- Structured logging for scheduled jobs (scheduler, digest, boot catch-up),
  the manual cron trigger, notification sends, and login attempts (success
  and failure, with a masked client IP) — visible via `docker logs`.
- Docker base image bumped to `node:26-bookworm-slim`, with OS packages
  updated during build.
- CI: manual Docker Hub publish now accepts a version input.

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
