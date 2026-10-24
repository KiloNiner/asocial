/**
 * Single sign-on settings, read from the environment. Any OpenID Connect
 * provider works (Pocket ID, Authentik, Keycloak, Authelia, Zitadel, Google…):
 * only the issuer URL is needed, endpoints come from its discovery document.
 */
export type OidcConfig = {
  issuer: string;
  clientId: string;
  /** Null = public client, authenticated by PKCE alone. */
  clientSecret: string | null;
  scopes: string;
  /** Label on the login button. */
  providerName: string;
  /** Create an account on first sign-in instead of requiring an existing one. */
  autoRegister: boolean;
  /** Accept an email the provider has not marked verified. */
  trustUnverifiedEmail: boolean;
  /** Members of this provider group are admins. Null = roles stay local. */
  adminGroup: string | null;
  /** Claim holding the user's groups (an array, or a single string). */
  groupsClaim: string;
  redirectUri: string;
};

type Env = Record<string, string | undefined>;

function flag(value: string | undefined, fallback: boolean): boolean {
  const v = value?.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}

/** Null when SSO is off — which includes a half-filled configuration. */
export function oidcConfig(env: Env = process.env): OidcConfig | null {
  const issuer = env.OIDC_ISSUER?.trim();
  const clientId = env.OIDC_CLIENT_ID?.trim();
  if (!issuer || !clientId) return null;

  const adminGroup = env.OIDC_ADMIN_GROUP?.trim() || null;
  // Groups only arrive if asked for (Pocket ID gates them behind a `groups`
  // scope), so asking is implied by naming an admin group — unless the
  // operator spelled out their own scopes, which are then used as written.
  const scopes =
    env.OIDC_SCOPES?.trim() ||
    (adminGroup ? "openid email profile groups" : "openid email profile");

  const base = (env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return {
    issuer,
    clientId,
    clientSecret: env.OIDC_CLIENT_SECRET?.trim() || null,
    scopes,
    providerName: env.OIDC_PROVIDER_NAME?.trim() || "SSO",
    autoRegister: flag(env.OIDC_AUTO_REGISTER, false),
    trustUnverifiedEmail: flag(env.OIDC_TRUST_UNVERIFIED_EMAIL, false),
    adminGroup,
    groupsClaim: env.OIDC_GROUPS_CLAIM?.trim() || "groups",
    redirectUri: `${base}/api/auth/oidc/callback`,
  };
}

/** True when only half of the required pair is set — worth a boot warning. */
export function oidcPartiallyConfigured(env: Env = process.env): boolean {
  return !oidcConfig(env) && Boolean(env.OIDC_ISSUER?.trim() || env.OIDC_CLIENT_ID?.trim());
}

/**
 * Password login can be switched off for an SSO-only deployment. It is
 * ignored unless SSO itself is configured, so a typo can't lock everyone out.
 */
export function passwordLoginEnabled(env: Env = process.env): boolean {
  if (!oidcConfig(env)) return true;
  return flag(env.PASSWORD_LOGIN, true);
}
