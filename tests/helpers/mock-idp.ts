import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

export type MockIdentity = {
  /** Claims placed in the signed ID token. */
  idToken: Record<string, unknown>;
  /** Claims served only from the userinfo endpoint. */
  userinfo?: Record<string, unknown>;
};

export type MockIdp = {
  issuer: string;
  /** Sets who the next authorize → token exchange will sign in as. */
  setIdentity(identity: MockIdentity): void;
  close(): Promise<void>;
};

const b64 = (x: string | Buffer) => Buffer.from(x).toString("base64url");

/**
 * A minimal in-process OpenID provider: discovery, JWKS, authorize (instant
 * redirect, PKCE enforced), token (RS256 ID token) and userinfo. Real enough
 * that openid-client verifies signature, issuer, audience, state and nonce
 * exactly as it would against Pocket ID.
 */
export async function startMockIdp(clientId = "test-client"): Promise<MockIdp> {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
  const codes = new Map<string, { identity: MockIdentity; nonce: string; challenge: string }>();
  let identity: MockIdentity = { idToken: { sub: "nobody" } };
  let issuer = "";

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", issuer);
    const json = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(body));
    };

    if (url.pathname === "/.well-known/openid-configuration") {
      return json(200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        userinfo_endpoint: `${issuer}/userinfo`,
        jwks_uri: `${issuer}/jwks`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
      });
    }
    if (url.pathname === "/jwks") return json(200, { keys: [jwk] });

    if (url.pathname === "/authorize") {
      const p = url.searchParams;
      if (p.get("code_challenge_method") !== "S256" || !p.get("code_challenge")) {
        return json(400, { error: "pkce_required" });
      }
      const code = crypto.randomUUID();
      codes.set(code, {
        identity,
        nonce: p.get("nonce") ?? "",
        challenge: p.get("code_challenge") as string,
      });
      res.statusCode = 302;
      res.setHeader(
        "location",
        `${p.get("redirect_uri")}?code=${code}&state=${p.get("state")}&iss=${encodeURIComponent(issuer)}`,
      );
      return res.end();
    }

    if (url.pathname === "/token") {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        const form = new URLSearchParams(body);
        const entry = codes.get(form.get("code") ?? "");
        const verifier = form.get("code_verifier") ?? "";
        const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
        if (!entry || challenge !== entry.challenge) {
          return json(400, { error: "invalid_grant" });
        }
        codes.delete(form.get("code") as string); // single use
        const now = Math.floor(Date.now() / 1000);
        const head = b64(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" }));
        const payload = b64(
          JSON.stringify({
            iss: issuer,
            aud: clientId,
            iat: now,
            exp: now + 300,
            nonce: entry.nonce,
            ...entry.identity.idToken,
          }),
        );
        const sig = crypto
          .sign("sha256", Buffer.from(`${head}.${payload}`), privateKey)
          .toString("base64url");
        // The userinfo claims ride along on the access token's value.
        json(200, {
          access_token: b64(JSON.stringify(entry.identity.userinfo ?? {})),
          token_type: "Bearer",
          id_token: `${head}.${payload}.${sig}`,
          expires_in: 300,
        });
      });
      return;
    }

    if (url.pathname === "/userinfo") {
      const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
      try {
        const extra = JSON.parse(Buffer.from(token, "base64url").toString());
        return json(200, { sub: identity.idToken.sub, ...extra });
      } catch {
        return json(401, { error: "invalid_token" });
      }
    }
    json(404, { error: "not_found" });
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    issuer,
    setIdentity: (i) => {
      identity = i;
    },
    close: () => new Promise((r) => server.close(() => r())),
  };
}
