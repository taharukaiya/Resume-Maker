import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "../src/lib/email";
import { assertProductionConfig } from "../src/lib/config";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = mocks.send;
  },
  SendEmailCommand: class {
    constructor(public input: unknown) {}
  },
}));
beforeEach(() => {
  vi.stubEnv("EMAIL_PROVIDER", "resend");
  vi.stubEnv("EMAIL_FROM", "Brilliancy <accounts@example.test>");
  vi.stubEnv("RESEND_API_KEY", "re_test_only");
  mocks.send.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("email provider routing", () => {
  it("sends invitation or recovery text through Resend without calling SES", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"id":"mail-id"}'));
    vi.stubGlobal("fetch", fetch);
    await sendEmail(
      "recipient@example.test",
      "Invitation",
      "Private invitation link",
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer re_test_only",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Brilliancy <accounts@example.test>",
          to: ["recipient@example.test"],
          subject: "Invitation",
          text: "Private invitation link",
        }),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it.each([401, 429, 500])(
    "does not leak responses or use a paid fallback on HTTP %s",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response("sensitive provider details", { status }),
          ),
      );
      await expect(sendEmail("a@example.test", "Test", "body")).rejects.toThrow(
        "Email delivery is temporarily unavailable. Please try again later.",
      );
      expect(mocks.send).not.toHaveBeenCalled();
    },
  );
  it("handles network failures without exposing credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("re_test_only")),
    );
    await expect(sendEmail("a@example.test", "Test", "body")).rejects.toThrow(
      "Email delivery is temporarily unavailable.",
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("requires a key before sending or starting production", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(sendEmail("a@example.test", "Test", "body")).rejects.toThrow(
      "not configured",
    );
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertProductionConfig()).toThrow("RESEND_API_KEY");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("retains explicitly selected SES support", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "ses");
    await sendEmail("a@example.test", "Test", "body");
    expect(mocks.send).toHaveBeenCalledOnce();
  });
  it("rejects unknown providers instead of silently using SES", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resned");
    await expect(sendEmail("a@example.test", "Test", "body")).rejects.toThrow(
      "unavailable",
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
