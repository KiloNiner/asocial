export async function register() {
  // Only in the real Node server process — not edge, not during build.
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  console.log(
    "[boot] starting:",
    JSON.stringify({
      nodeEnv: process.env.NODE_ENV,
      timezone: process.env.TZ ?? "Europe/Copenhagen",
    }),
  );

  const { oidcConfig, oidcPartiallyConfigured, passwordLoginEnabled } =
    await import("./lib/auth/oidc/config");
  const sso = oidcConfig();
  if (sso) {
    console.log(
      "[boot] sso enabled:",
      JSON.stringify({
        issuer: sso.issuer,
        redirectUri: sso.redirectUri,
        autoRegister: sso.autoRegister,
        passwordLogin: passwordLoginEnabled(),
      }),
    );
  } else if (oidcPartiallyConfigured()) {
    console.warn(
      "[boot] sso disabled: set both OIDC_ISSUER and OIDC_CLIENT_ID to enable it",
    );
  }

  const { runMigrations } = await import("./db/migrate");
  runMigrations();
  console.log("[boot] migrations applied");

  const { startCronJobs } = await import("./lib/cron");
  startCronJobs();
  console.log("[boot] cron jobs started");
}
