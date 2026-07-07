/**
 * Seeds the database with deterministic demo data for development and QA.
 * Usage: npm run seed [-- --reset]
 * --reset deletes the database file first.
 *
 * Demo accounts: karsten@example.com / demo-password-1
 *                mette@example.com   / demo-password-2
 */
import fs from "node:fs";

const reset = process.argv.includes("--reset");
const dbPath = process.env.DATABASE_PATH ?? "./dev.db";

if (reset) {
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
  console.log(`Removed ${dbPath}`);
}

/** Deterministic rng so seeded data is stable between runs. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const { runMigrations } = await import("../src/db/migrate");
  runMigrations();
  console.log("Migrations applied.");

  const { db } = await import("../src/db");
  const {
    users,
    userSettings,
    circles,
    circleContactPrefs,
    contactTypes,
    friends,
    friendCircles,
    friendContactPrefs,
    interactions,
    userContactPrefs,
  } = await import("../src/db/schema");
  const { hashPassword } = await import("../src/lib/auth/password");
  const { count } = await import("drizzle-orm");

  const existing = db.select({ n: count() }).from(users).get()?.n ?? 0;
  if (existing > 0) {
    console.log("Users already present — skipping demo seed.");
    return;
  }

  const rng = mulberry32(42);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  // ---- users ----
  const [karsten, mette] = db
    .insert(users)
    .values([
      {
        email: "karsten@example.com",
        passwordHash: await hashPassword("demo-password-1"),
        displayName: "Karsten Demo",
        role: "admin",
      },
      {
        email: "mette@example.com",
        passwordHash: await hashPassword("demo-password-2"),
        displayName: "Mette Demo",
        role: "user",
      },
    ])
    .returning()
    .all();
  db.insert(userSettings)
    .values([{ userId: karsten.id }, { userId: mette.id, locale: "da" }])
    .run();

  // Karsten globally never wants to host visits (globally disabled type).
  db.insert(userContactPrefs)
    .values({ userId: karsten.id, contactTypeId: "host_visit", weight: 0 })
    .run();

  // ---- custom contact type ----
  const gaming = db
    .insert(contactTypes)
    .values({
      userId: karsten.id,
      name: "Online gaming session",
      emoji: "🎮",
      defaultWeight: 15,
      sortOrder: 100,
    })
    .returning()
    .get();

  // ---- circles ----
  const [close, classmates, gamers, longDistance] = db
    .insert(circles)
    .values([
      { userId: karsten.id, name: "Close friends", color: "#0d9488", intervalDays: 14, sortOrder: 1 },
      { userId: karsten.id, name: "Old classmates", color: "#7c3aed", intervalDays: 60, sortOrder: 2 },
      { userId: karsten.id, name: "Board game group", color: "#ea580c", intervalDays: 30, sortOrder: 3 },
      { userId: karsten.id, name: "Long distance", color: "#2563eb", intervalDays: 45, sortOrder: 4 },
    ])
    .returning()
    .all();

  // Long-distance circle: never suggest visits; lean on calls.
  db.insert(circleContactPrefs)
    .values([
      { circleId: longDistance.id, contactTypeId: "visit_them", weight: 0 },
      { circleId: longDistance.id, contactTypeId: "host_visit", weight: 0 },
      { circleId: longDistance.id, contactTypeId: "call", weight: 40 },
    ])
    .run();
  // Board game group leans hosting/activity.
  db.insert(circleContactPrefs)
    .values([
      { circleId: gamers.id, contactTypeId: "host_visit", weight: 25 },
      { circleId: gamers.id, contactTypeId: "activity", weight: 25 },
    ])
    .run();

  // ---- friends (12 for karsten, edge cases included) ----
  type F = {
    name: string;
    circles: string[];
    override?: number;
    autoschedule?: boolean;
    birth?: [number, number, number?]; // day, month, year?
    notes?: string;
  };
  const friendDefs: F[] = [
    { name: "Anna", circles: [close.id], birth: [12, 3, 1985], notes: "Partner: Jonas. Two kids." },
    { name: "Bjørn", circles: [close.id, gamers.id], birth: [29, 2, 1988], notes: "Born Feb 29 — leap-year birthday." },
    { name: "Cecilie", circles: [classmates.id], override: 21, notes: "Closer than the rest of the class — override 21d." },
    { name: "David", circles: [classmates.id], birth: [7, 11] },
    { name: "Emil", circles: [gamers.id] },
    { name: "Freja", circles: [longDistance.id], birth: [24, 6, 1990], notes: "Lives in Aarhus." },
    { name: "Gustav", circles: [longDistance.id, classmates.id] },
    { name: "Hanne", circles: [close.id], autoschedule: false, notes: "Autoschedule off — manual only." },
    { name: "Ida", circles: [gamers.id, close.id], birth: [1, 1, 1992] },
    { name: "Jakob", circles: [classmates.id] },
    { name: "Klara", circles: [], notes: "No circle — falls back to default interval." },
    { name: "Lars", circles: [longDistance.id], birth: [15, 8] },
  ];

  const friendIds: string[] = [];
  for (const def of friendDefs) {
    const friend = db
      .insert(friends)
      .values({
        userId: karsten.id,
        name: def.name,
        notes: def.notes ?? null,
        intervalOverrideDays: def.override ?? null,
        autoschedule: def.autoschedule ?? true,
        birthDay: def.birth?.[0] ?? null,
        birthMonth: def.birth?.[1] ?? null,
        birthYear: def.birth?.[2] ?? null,
      })
      .returning()
      .get();
    friendIds.push(friend.id);
    if (def.circles.length > 0) {
      db.insert(friendCircles)
        .values(def.circles.map((circleId) => ({ friendId: friend.id, circleId })))
        .run();
    }
  }

  // Friend-level pref: Emil loves gaming sessions.
  db.insert(friendContactPrefs)
    .values({ friendId: friendIds[4], contactTypeId: gaming.id, weight: 50 })
    .run();

  // ---- interactions spread over ~6 months ----
  const typePool = ["message", "call", "coffee", "activity", "visit_them"];
  const notes = [
    "Talked about the kids and the new house.",
    "Long catch-up — planning a summer meetup.",
    "Quick check-in, all well.",
    "Board game night recap, next one at Emil's.",
    "Discussed work changes.",
    null,
  ];
  const rows = [];
  for (let i = 0; i < 30; i++) {
    const friendIdx = Math.floor(rng() * friendIds.length);
    rows.push({
      userId: karsten.id,
      friendId: friendIds[friendIdx],
      contactTypeId: pick(typePool),
      occurredOn: isoDaysAgo(Math.floor(rng() * 180) + 1),
      note: pick(notes),
    });
  }
  db.insert(interactions).values(rows).run();

  // ---- second user: minimal isolated data ----
  const metteCircle = db
    .insert(circles)
    .values({ userId: mette.id, name: "Veninder", color: "#db2777", intervalDays: 21 })
    .returning()
    .get();
  const metteFriend = db
    .insert(friends)
    .values({ userId: mette.id, name: "Sofie" })
    .returning()
    .get();
  db.insert(friendCircles)
    .values({ friendId: metteFriend.id, circleId: metteCircle.id })
    .run();
  db.insert(interactions)
    .values({
      userId: mette.id,
      friendId: metteFriend.id,
      contactTypeId: "coffee",
      occurredOn: isoDaysAgo(10),
      note: "Kaffe i byen.",
    })
    .run();

  console.log(
    `Seeded: 2 users, 5 circles, ${friendDefs.length + 1} friends, 31 interactions, 1 custom type.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
