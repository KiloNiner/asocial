import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// No Strict-Transport-Security here on purpose. `headers()` is evaluated at
// build time and baked into routes-manifest.json, so it cannot branch on the
// deployment's APP_URL the way secureCookies() does — and sending HSTS
// unconditionally would pin the upgrade and lock an http-only self-host out
// of its own app. It belongs on whatever terminates TLS.
const securityHeaders = [
  // Not a full CSP: Next's inline bootstrap scripts would need nonces, and a
  // half-applied script-src is worse than none. frame-ancestors is the part
  // that buys something here — this app has no reason to be framed, and the
  // whole UI is one-click actions on a logged-in session.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Friend ids live in the path; don't leak them to anywhere a user clicks
  // out to. Same-origin still gives internal navigation a full referrer.
  { key: "Referrer-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "@node-rs/argon2"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
