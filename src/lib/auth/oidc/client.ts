import * as oidc from "openid-client";
import { oidcConfig, type OidcConfig } from "./config";
import { parseGroups, type OidcClaims } from "./decide";

// Every outbound call to the provider needs a ceiling: a hung IdP must fail a
// login, not hold a request open forever.
const TIMEOUT_SECONDS = 10;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

let cached: { key: string; at: number; config: oidc.Configuration } | null = null;

async function discover(cfg: OidcConfig): Promise<oidc.Configuration> {
  const key = `${cfg.issuer}|${cfg.clientId}|${cfg.clientSecret ?? ""}`;
  if (cached && cached.key === key && Date.now() - cached.at < DISCOVERY_TTL_MS) {
    return cached.config;
  }
  const issuer = new URL(cfg.issuer);
  const config = await oidc.discovery(
    issuer,
    cfg.clientId,
    cfg.clientSecret ?? undefined,
    cfg.clientSecret ? undefined : oidc.None(),
    {
      timeout: TIMEOUT_SECONDS,
      // An operator who points at a plain-http issuer (a LAN-only provider) has
      // chosen that; https is still required for everything else.
      execute: issuer.protocol === "http:" ? [oidc.allowInsecureRequests] : [],
    },
  );
  cached = { key, at: Date.now(), config };
  return config;
}

/** What the browser must carry from /login to /callback. */
export type OidcFlowState = { state: string; nonce: string; verifier: string };

export async function beginAuthorization(
  cfg: OidcConfig,
): Promise<{ url: URL; flow: OidcFlowState }> {
  const config = await discover(cfg);
  const verifier = oidc.randomPKCECodeVerifier();
  const flow: OidcFlowState = {
    state: oidc.randomState(),
    nonce: oidc.randomNonce(),
    verifier,
  };
  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: cfg.redirectUri,
    scope: cfg.scopes,
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
    state: flow.state,
    nonce: flow.nonce,
  });
  return { url, flow };
}

export type OidcIdentity = OidcClaims & {
  issuer: string;
  subject: string;
  name: string | null;
  /** Null when the provider sent no groups claim at all. */
  groups: string[] | null;
};

/** Exchanges the code and returns the verified identity. Throws on any
 *  protocol failure (bad state, nonce, signature, expired code, IdP error). */
export async function completeAuthorization(
  cfg: OidcConfig,
  query: string,
  flow: OidcFlowState,
): Promise<OidcIdentity> {
  const config = await discover(cfg);
  // Rebuilt from the configured redirect URI: behind a reverse proxy the
  // request's own URL would carry the internal host and fail the issuer check.
  const callback = new URL(cfg.redirectUri);
  callback.search = query;

  const tokens = await oidc.authorizationCodeGrant(config, callback, {
    pkceCodeVerifier: flow.verifier,
    expectedState: flow.state,
    expectedNonce: flow.nonce,
    idTokenExpected: true,
  });
  const idToken = tokens.claims();
  if (!idToken) throw new Error("no id_token returned");

  // Some providers leave profile claims out of the ID token and serve them
  // from the userinfo endpoint only.
  let info: oidc.UserInfoResponse | null = null;
  const needGroups = cfg.adminGroup !== null && idToken[cfg.groupsClaim] === undefined;
  if (!idToken.email || idToken.email_verified === undefined || needGroups) {
    info = await oidc.fetchUserInfo(config, tokens.access_token, idToken.sub);
  }
  const claim = (k: string) => idToken[k] ?? info?.[k];

  const email = claim("email");
  const name = claim("name") ?? claim("preferred_username");
  return {
    issuer: cfg.issuer,
    subject: idToken.sub,
    email: typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null,
    emailVerified: claim("email_verified") === true,
    groups: cfg.adminGroup ? parseGroups(claim(cfg.groupsClaim)) : null,
    name: typeof name === "string" && name.trim() ? name.trim() : null,
  };
}

export { oidcConfig };
