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
