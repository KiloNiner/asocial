/** The identity facts we trust after the provider has vouched for them. */
export type OidcClaims = {
  email: string | null;
  emailVerified: boolean;
};

export type SignInInput = {
  /** User already linked to this (issuer, subject), if any. */
  linkedUserId: string | null;
  /** Local user whose email equals the claim, if any. */
  emailUserId: string | null;
  userCount: number;
  claims: OidcClaims;
  autoRegister: boolean;
  trustUnverifiedEmail: boolean;
};

export type DenyReason = "noEmail" | "emailUnverified" | "noAccount";

export type SignInDecision =
  | { kind: "existing"; userId: string }
  | { kind: "link"; userId: string }
  | { kind: "create"; admin: boolean }
  | { kind: "deny"; reason: DenyReason };

/**
 * Pure policy for "who is this SSO sign-in?". A known (issuer, subject) always
 * wins. Otherwise the email is the only bridge to a local account, and an
 * unverified one must never be allowed to claim someone else's address —
 * that would be account takeover by registering at a lax provider.
 */
export function decideSignIn(input: SignInInput): SignInDecision {
  if (input.linkedUserId) return { kind: "existing", userId: input.linkedUserId };

  const { email, emailVerified } = input.claims;
  if (!email) return { kind: "deny", reason: "noEmail" };
  if (!emailVerified && !input.trustUnverifiedEmail) {
    return { kind: "deny", reason: "emailUnverified" };
  }

  if (input.emailUserId) return { kind: "link", userId: input.emailUserId };

  // Same rule as the register page: the first account on an empty instance is
  // the admin, whatever the registration policy.
  if (input.userCount === 0) return { kind: "create", admin: true };
  if (input.autoRegister) return { kind: "create", admin: false };
  return { kind: "deny", reason: "noAccount" };
}

/**
 * Normalises a groups claim. Providers send an array of names, or a lone
 * string; anything else (absent, wrong type) is "unknown", which is not the
 * same as "member of nothing" and must never demote anyone.
 */
export function parseGroups(value: unknown): string[] | null {
  if (typeof value === "string") return value ? [value] : [];
  if (!Array.isArray(value)) return null;
  return value.filter((g): g is string => typeof g === "string");
}

export type RoleInput = {
  currentRole: "admin" | "user";
  /** Whether the provider says the user is in the admin group; null = unknown. */
  inAdminGroup: boolean | null;
  adminCount: number;
};

/**
 * The provider is the source of truth for admin status of people who sign in
 * through it. Returns the role to set, or null to leave things alone. The last
 * remaining admin is never demoted — a misconfigured group name must not be
 * able to lock everyone out of the admin page.
 */
export function decideRole(input: RoleInput): "admin" | "user" | null {
  if (input.inAdminGroup === null) return null;
  if (input.inAdminGroup && input.currentRole === "user") return "admin";
  if (!input.inAdminGroup && input.currentRole === "admin") {
    return input.adminCount > 1 ? "user" : null;
  }
  return null;
}
