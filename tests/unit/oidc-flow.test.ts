import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startMockIdp, type MockIdentity, type MockIdp } from "../helpers/mock-idp";

// Point the db module at a throwaway SQLite file before anything imports it.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "asocial-oidc-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");

type Client = typeof import("@/lib/auth/oidc/client");
type Cfg = import("@/lib/auth/oidc/config").OidcConfig;

const ADMINS = "asocial_admins";

let idp: MockIdp;
let client: Client;
let resolve: typeof import("@/lib/auth/oidc/resolve");
let cfg: Cfg;

const person = (over: Record<string, unknown> = {}): MockIdentity => ({
  idToken: {
    sub: "sub-1",
    email: "ada@example.com",
    email_verified: true,
    name: "Ada",
    groups: [],
    ...over,
  },
});

/** Full browser round trip against the mock provider, as the real routes do. */
async function signIn(identity: MockIdentity, c: Cfg = cfg) {
  idp.setIdentity(identity);
  const { url, flow } = await client.beginAuthorization(c);
  const res = await fetch(url, { redirect: "manual" });
  const back = new URL(res.headers.get("location") as string);
  return { identity: await client.completeAuthorization(c, back.search, flow), flow, back };
}

beforeAll(async () => {
  idp = await startMockIdp("test-client");
  const { runMigrations } = await import("@/db/migrate");
  runMigrations();
  client = await import("@/lib/auth/oidc/client");
  resolve = await import("@/lib/auth/oidc/resolve");
  const { oidcConfig } = await import("@/lib/auth/oidc/config");
  cfg = oidcConfig({
    OIDC_ISSUER: idp.issuer,
    OIDC_CLIENT_ID: "test-client",
    OIDC_ADMIN_GROUP: ADMINS,
    OIDC_AUTO_REGISTER: "true",
    APP_URL: "http://localhost:3000",
  }) as Cfg;
});

afterAll(async () => {
  await idp.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("authorization code flow", () => {
  it("returns the verified identity, with groups from the ID token", async () => {
    const { identity } = await signIn(person({ groups: [ADMINS, "other"] }));
    expect(identity).toMatchObject({
      issuer: idp.issuer,
      subject: "sub-1",
      email: "ada@example.com",
      emailVerified: true,
      name: "Ada",
      groups: [ADMINS, "other"],
    });
  });

  it("requests the groups scope and PKCE", async () => {
    const { url } = await client.beginAuthorization(cfg);
    expect(url.searchParams.get("scope")).toContain("groups");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("nonce")).toBeTruthy();
  });

  it("falls back to userinfo when the ID token omits email and groups", async () => {
    const { identity } = await signIn({
      idToken: { sub: "sub-2" },
      userinfo: { email: "Bo@Example.com", email_verified: true, groups: [ADMINS] },
    });
    expect(identity).toMatchObject({
      email: "bo@example.com",
      emailVerified: true,
      groups: [ADMINS],
    });
  });

  it("reports groups as unknown (null) when the provider sends none", async () => {
    const { identity } = await signIn({
      idToken: { sub: "sub-3", email: "c@example.com", email_verified: true },
    });
    expect(identity.groups).toBeNull();
  });

  it("reads a custom groups claim and a single-string value", async () => {
    const custom = { ...cfg, groupsClaim: "roles" };
    const { identity } = await signIn(person({ roles: ADMINS }), custom);
    expect(identity.groups).toEqual([ADMINS]);
  });

  it("does not look at groups at all when no admin group is configured", async () => {
    const plain = { ...cfg, adminGroup: null };
    const { identity } = await signIn(person({ groups: [ADMINS] }), plain);
    expect(identity.groups).toBeNull();
  });

  it("rejects a forged state", async () => {
    idp.setIdentity(person());
    const { url, flow } = await client.beginAuthorization(cfg);
    const res = await fetch(url, { redirect: "manual" });
    const back = new URL(res.headers.get("location") as string);
    back.searchParams.set("state", "forged");
    await expect(client.completeAuthorization(cfg, back.search, flow)).rejects.toThrow();
  });

  it("rejects a mismatched nonce", async () => {
    idp.setIdentity(person());
    const { url, flow } = await client.beginAuthorization(cfg);
    const res = await fetch(url, { redirect: "manual" });
    const back = new URL(res.headers.get("location") as string);
    await expect(
      client.completeAuthorization(cfg, back.search, { ...flow, nonce: "other" }),
    ).rejects.toThrow();
  });

  it("rejects a replayed authorization code", async () => {
    const { flow, back } = await signIn(person());
    await expect(client.completeAuthorization(cfg, back.search, flow)).rejects.toThrow();
  });
});

describe("group → admin mapping (resolveSignIn)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");

  async function login(over: Record<string, unknown>, c: Cfg = cfg) {
    const { identity } = await signIn(person(over), c);
    return resolve.resolveSignIn(c, identity, "en");
  }
  const user = (email: string) =>
    db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, email) });

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
  });

  beforeEach(() => {
    db.delete(schema.users).run(); // cascades to identities and settings
  });

  /** Seeds an existing local account. */
  const seed = (email: string, role: "admin" | "user") =>
    db
      .insert(schema.users)
      .values({ email, passwordHash: "x", displayName: email, role })
      .returning()
      .get();

  it("creates a new account as admin when the user is in the admin group", async () => {
    seed("root@example.com", "admin"); // not the bootstrap case
    const out = await login({ sub: "n1", email: "new@example.com", groups: [ADMINS] });
    expect(out).toMatchObject({ how: "created" });
    expect((await user("new@example.com"))?.role).toBe("admin");
  });

  it("creates a plain user when not in the admin group", async () => {
    seed("root@example.com", "admin");
    await login({ sub: "n2", email: "new@example.com", groups: ["friends"] });
    expect((await user("new@example.com"))?.role).toBe("user");
  });

  it("promotes an existing user on sign-in, including via first-time linking", async () => {
    seed("root@example.com", "admin");
    seed("ada@example.com", "user");
    const out = await login({ groups: [ADMINS] });
    expect(out).toMatchObject({ how: "linked", roleChange: "admin" });
    expect((await user("ada@example.com"))?.role).toBe("admin");
  });

  it("demotes an admin who has left the group", async () => {
    seed("root@example.com", "admin");
    seed("ada@example.com", "admin");
    const out = await login({ groups: [] });
    expect(out).toMatchObject({ roleChange: "user" });
    expect((await user("ada@example.com"))?.role).toBe("user");
  });

  it("never demotes the last admin", async () => {
    seed("ada@example.com", "admin");
    const out = await login({ groups: [] });
    expect(out).toMatchObject({ how: "linked" });
    expect("roleChange" in out && out.roleChange).toBeFalsy();
    expect((await user("ada@example.com"))?.role).toBe("admin");
  });

  it("leaves roles alone when the provider sends no groups claim", async () => {
    seed("root@example.com", "admin");
    seed("ada@example.com", "admin");
    idp.setIdentity({ idToken: { sub: "sub-1", email: "ada@example.com", email_verified: true } });
    const { url, flow } = await client.beginAuthorization(cfg);
    const back = new URL(
      (await fetch(url, { redirect: "manual" })).headers.get("location") as string,
    );
    const identity = await client.completeAuthorization(cfg, back.search, flow);
    const out = resolve.resolveSignIn(cfg, identity, "en");
    expect("roleChange" in out && out.roleChange).toBeFalsy();
    expect((await user("ada@example.com"))?.role).toBe("admin");
  });

  it("does not touch roles when no admin group is configured", async () => {
    const plain = { ...cfg, adminGroup: null };
    seed("root@example.com", "admin");
    seed("ada@example.com", "user");
    await login({ groups: [ADMINS] }, plain);
    expect((await user("ada@example.com"))?.role).toBe("user");
  });

  it("makes the first user admin even outside the admin group", async () => {
    await login({ sub: "first", email: "first@example.com", groups: [] });
    expect((await user("first@example.com"))?.role).toBe("admin");
  });

  it("refuses to link an unverified email even for an admin-group member", async () => {
    seed("ada@example.com", "user");
    const out = await login({ email_verified: false, groups: [ADMINS] });
    expect(out).toEqual({ error: "emailUnverified" });
    expect((await user("ada@example.com"))?.role).toBe("user");
  });
});
