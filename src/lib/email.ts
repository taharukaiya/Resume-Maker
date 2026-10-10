import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { config } from "./config";
import { invariant } from "./errors";
export async function sendEmail(to: string, subject: string, text: string) {
  invariant(process.env.EMAIL_FROM, 503, "Email delivery is not configured.");
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
