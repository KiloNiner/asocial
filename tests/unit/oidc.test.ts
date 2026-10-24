import { describe, expect, it } from "vitest";
import {
  oidcConfig,
  oidcPartiallyConfigured,
  passwordLoginEnabled,
} from "@/lib/auth/oidc/config";
import { decideSignIn, type SignInInput } from "@/lib/auth/oidc/decide";

const base = { OIDC_ISSUER: "https://id.example.com", OIDC_CLIENT_ID: "abc" };

describe("oidcConfig", () => {
  it("is off without issuer and client id", () => {
    expect(oidcConfig({})).toBeNull();
    expect(oidcConfig({ OIDC_ISSUER: "https://x" })).toBeNull();
    expect(oidcPartiallyConfigured({ OIDC_ISSUER: "https://x" })).toBe(true);
    expect(oidcPartiallyConfigured({})).toBe(false);
  });

  it("applies defaults and derives the redirect URI", () => {
    const cfg = oidcConfig({ ...base, APP_URL: "https://asocial.example.com/" });
    expect(cfg).toMatchObject({
      clientSecret: null,
      scopes: "openid email profile",
      providerName: "SSO",
      autoRegister: false,
      trustUnverifiedEmail: false,
      redirectUri: "https://asocial.example.com/api/auth/oidc/callback",
    });
  });

  it("parses flags and overrides", () => {
    const cfg = oidcConfig({
      ...base,
      OIDC_CLIENT_SECRET: " s ",
      OIDC_AUTO_REGISTER: "true",
      OIDC_PROVIDER_NAME: "Pocket ID",
    });
    expect(cfg).toMatchObject({
      clientSecret: "s",
      autoRegister: true,
      providerName: "Pocket ID",
    });
  });
});

describe("passwordLoginEnabled", () => {
  it("stays on unless SSO is configured and it is switched off", () => {
    expect(passwordLoginEnabled({ PASSWORD_LOGIN: "false" })).toBe(true);
    expect(passwordLoginEnabled(base)).toBe(true);
    expect(passwordLoginEnabled({ ...base, PASSWORD_LOGIN: "false" })).toBe(false);
  });
});

describe("decideSignIn", () => {
  const input = (o: Partial<SignInInput> = {}): SignInInput => ({
    linkedUserId: null,
    emailUserId: null,
    userCount: 3,
    claims: { email: "a@b.dk", emailVerified: true },
    autoRegister: false,
    trustUnverifiedEmail: false,
    ...o,
  });

  it("a linked identity always wins, even without an email", () => {
    expect(
      decideSignIn(
        input({ linkedUserId: "u1", claims: { email: null, emailVerified: false } }),
      ),
    ).toEqual({ kind: "existing", userId: "u1" });
  });

  it("links a verified email to the existing account", () => {
    expect(decideSignIn(input({ emailUserId: "u2" }))).toEqual({
      kind: "link",
      userId: "u2",
    });
  });

  it("refuses to link an unverified email unless trusted", () => {
    const claims = { email: "a@b.dk", emailVerified: false };
    expect(decideSignIn(input({ emailUserId: "u2", claims }))).toEqual({
      kind: "deny",
      reason: "emailUnverified",
    });
    expect(
      decideSignIn(input({ emailUserId: "u2", claims, trustUnverifiedEmail: true })),
    ).toEqual({ kind: "link", userId: "u2" });
  });

  it("denies a missing email", () => {
    expect(
      decideSignIn(input({ claims: { email: null, emailVerified: false } })),
    ).toEqual({ kind: "deny", reason: "noEmail" });
  });

  it("only creates accounts when auto-register is on", () => {
    expect(decideSignIn(input())).toEqual({ kind: "deny", reason: "noAccount" });
    expect(decideSignIn(input({ autoRegister: true }))).toEqual({
      kind: "create",
      admin: false,
    });
  });

  it("makes the first user on an empty instance the admin", () => {
    expect(decideSignIn(input({ userCount: 0 }))).toEqual({
      kind: "create",
      admin: true,
    });
  });
});
