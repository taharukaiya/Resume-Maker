import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { config } from "./config";
import { invariant } from "./errors";
export async function sendEmail(to: string, subject: string, text: string) {
  invariant(process.env.EMAIL_FROM, 503, "Email delivery is not configured.");
  const provider = process.env.EMAIL_PROVIDER || "ses";
  invariant(
    ["ses", "resend"].includes(provider),
    503,
    "Email delivery is unavailable.",
  );
  if (provider === "resend") {
    invariant(
      process.env.RESEND_API_KEY,
      503,
      "Email delivery is not configured.",
    );
    // Never fall back to a billable provider or expose provider responses/tokens.
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: [to],
          subject,
          text,
        }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      invariant(
        false,
        503,
        "Email delivery is temporarily unavailable. Please try again later.",
      );
    }
    invariant(
      response.ok,
      503,
      "Email delivery is temporarily unavailable. Please try again later.",
    );
    return;
  }
  const client = new SESv2Client({ region: config().region });
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: process.env.EMAIL_FROM,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Text: { Data: text, Charset: "UTF-8" } },
        },
      },
    }),
  );
}
