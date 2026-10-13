import { config } from "@/lib/config";
import { hash, hashPassword, token } from "@/lib/crypto";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { invariant } from "@/lib/errors";
import {
  audit,
  initialize,
  login,
  rateLimit,
  type User,
} from "@/modules/auth/service";
import { escapeHtml } from "@/modules/publishing/render";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  body,
  cookieName,
  emailSchema,
  idSchema,
  json,
  passwordSchema,
  readLimited,
} from "./shared";

export async function publicRoutes(
  request: NextRequest,
  path: string[],
  database: Awaited<ReturnType<typeof db>>,
): Promise<Response | null> {
  const route = path.join("/"),
    method = request.method;
  if (route === "status" && method === "GET") {
    const users = await database.query("SELECT id FROM users LIMIT 1");
    return json({
      initialized: !!users.length,
      agencyName: "Brilliancy Research",
    });
  }
  if (route === "setup" && method === "POST") {
    await rateLimit("setup", 10, 900);
    const input = z
      .object({
        token: z.string(),
        name: z.string().trim().min(1).max(100),
        email: emailSchema,
        password: passwordSchema,
        agencyName: z.string().trim().min(1).max(100),
      })
      .strict()
      .parse(await body(request));
    await initialize(input);
    return json({ ok: true });
  }
  if (route === "auth/login" && method === "POST") {
    // The VPS proxy overwrites this header; the web port must stay private.
    if (config().vps)
      await rateLimit(
        `login:ip:${request.headers.get("x-brilliancy-ip") || "unknown"}`,
        30,
        900,
      );
    await rateLimit("login:global", 500, 900);
    const input = z
      .object({
        email: emailSchema,
        password: z.string().max(128),
        code: z.string().max(8).default(""),
      })
      .parse(await body(request));
    const result = await login(input.email, input.password, input.code);
    const response = json({ user: result.user });
    response.cookies.set(cookieName(), result.session, {
      httpOnly: true,
      secure: config().production,
      sameSite: "lax",
      path: "/",
      maxAge: 43200,
    });
    return response;
  }
  if (route === "auth/accept" && method === "POST") {
    await rateLimit("accept:global", 100, 900);
    const input = z
      .object({ token: z.string().max(100), password: passwordSchema })
      .parse(await body(request));
    const passwordHash = await hashPassword(input.password);
    await database.transaction(async (tx) => {
      const [invite] = await tx.query<{ user_id: string }>(
        "DELETE FROM account_tokens WHERE token_hash=$1 AND expires_at>now() RETURNING user_id",
        [hash(input.token)],
      );
      invariant(invite, 400, "This link has expired or has already been used.");
      await tx.query(
        "UPDATE users SET password_hash=$1 WHERE id=$2 AND disabled=false",
        [passwordHash, invite.user_id],
      );
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [invite.user_id]);
      await tx.query("DELETE FROM account_tokens WHERE user_id=$1", [
        invite.user_id,
      ]);
      await audit(invite.user_id, null, "auth.password_set", {}, tx);
    });
    return json({ ok: true });
  }
  if (route === "auth/forgot" && method === "POST") {
    invariant(
      process.env.EMAIL_FROM,
      503,
      "Password recovery email is not configured. Contact your administrator for a new access link.",
    );
    const { email } = z
      .object({ email: emailSchema })
      .parse(await body(request));
    await rateLimit(`reset:${email}`, 3, 3600);
    await rateLimit("reset:global", 100, 3600);
    const [user] = await database.query<User>(
      "SELECT * FROM users WHERE email=$1 AND disabled=false",
      [email],
    );
    if (user) {
      const secret = token();
      await database.query(
        "INSERT INTO account_tokens(token_hash,user_id,kind,expires_at) VALUES($1,$2,'reset',now()+interval '30 minutes')",
        [hash(secret), user.id],
      );
      await sendEmail(
        email,
        "Reset your Brilliancy Research password",
        `Set a new password using this single-use link. It expires in 30 minutes.\n\n${config().appUrl}/accept?token=${secret}\n\nIf you did not request this, ignore this email.`,
      );
    }
    return json({
      ok: true,
      message:
        "If an active account matches this email, a recovery link has been sent.",
    });
  }
  if (route === "public/inquiry" && method === "POST") {
    const bytes = await readLimited(request, 16000);
    const form = new URLSearchParams(Buffer.from(bytes).toString());
    const input = z
      .object({
        siteId: idSchema,
        name: z.string().trim().min(1).max(120),
        email: emailSchema,
        message: z.string().trim().min(10).max(5000),
        website: z.string().optional(),
      })
      .parse(Object.fromEntries(form));
    if (input.website)
      return new Response("Thank you. Your message was received.", {
        headers: { "Content-Type": "text/plain" },
      });
    await rateLimit(`inquiry:${input.siteId}`, 100, 3600);
    await rateLimit(`inquiry:${input.siteId}:${input.email}`, 3, 3600);
    const [site] = await database.query<{
      published_release_id: string;
      document: { labels: { receivedTitle: string; receivedMessage: string } };
    }>(
      "SELECT s.published_release_id,r.document FROM sites s JOIN releases r ON r.id=s.published_release_id WHERE s.id=$1",
      [input.siteId],
    );
    invariant(site?.published_release_id, 404, "Portfolio is not published.");
    await database.query(
      "INSERT INTO inquiries(id,site_id,name,email,message) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), input.siteId, input.name, input.email, input.message],
    );
    return new Response(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(site.document.labels.receivedTitle)}</title><body style="font:18px system-ui;max-width:600px;margin:15vh auto;padding:24px"><h1>${escapeHtml(site.document.labels.receivedTitle)}</h1><p>${escapeHtml(site.document.labels.receivedMessage)}</p></body></html>`,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy":
            "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
        },
      },
    );
  }

  return null;
}
