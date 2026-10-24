import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended argon2id parameters.
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

/** Stored for accounts created through SSO. Not a valid argon2 string, so
 *  verifyPassword() can never accept it; a reset link can still set a real one. */
export const UNUSABLE_PASSWORD_HASH = "!";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
