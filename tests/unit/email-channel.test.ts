import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Digest } from "@/lib/notifications/digest";
import type { User, UserSettings } from "@/db/schema";

const createTransport = vi.fn();
createTransport.mockReturnValue({
  sendMail: vi.fn().mockResolvedValue(undefined),
});

vi.mock("nodemailer", () => ({
  default: { createTransport },
}));

const user: User = {
  id: "u1",
  email: "user@example.com",
  passwordHash: "hash",
  displayName: "User",
  role: "user",
  createdAt: Date.now(),
};

const settings: UserSettings = {
  userId: "u1",
  locale: "en",
  timezone: "Europe/Copenhagen",
  actionWindowDays: 7,
  jitterPct: 25,
  digestHour: 8,
  defaultIntervalDays: 30,
  theme: "auto",
};

const digest: Digest = { date: "2026-07-10", items: [] };

async function loadEmailChannel() {
  vi.resetModules();
  const mod = await import("@/lib/notifications/channels/email");
  return mod.emailChannel;
}

describe("emailChannel SMTP TLS options", () => {
  beforeEach(() => {
    createTransport.mockClear();
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_TLS_REJECT_UNAUTHORIZED", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("leaves tls unset by default (verifies certs)", async () => {
    const emailChannel = await loadEmailChannel();
    await emailChannel.send(user, settings, digest, {});

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ tls: undefined }),
    );
  });

  it("disables cert verification when SMTP_TLS_REJECT_UNAUTHORIZED=false", async () => {
    vi.stubEnv("SMTP_TLS_REJECT_UNAUTHORIZED", "false");
    const emailChannel = await loadEmailChannel();
    await emailChannel.send(user, settings, digest, {});

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ tls: { rejectUnauthorized: false } }),
    );
  });
});
