/** The deployment's public base URL, without a trailing slash. */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
