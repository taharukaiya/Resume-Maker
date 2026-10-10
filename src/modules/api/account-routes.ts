import { config } from "@/lib/config";
import {
  checkPassword,
  decrypt,
  encrypt,
  hash,
  hashPassword,
  token,
} from "@/lib/crypto";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { invariant } from "@/lib/errors";
import {
  audit,
  publicUser,
  rateLimit,
  requireAdmin,
  type User,
} from "@/modules/auth/service";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { z } from "zod";
import {
  body,
  cookieName,
  emailSchema,
  idSchema,
  json,
  passwordSchema,
} from "./shared";

export async function accountRoutes(
  request: NextRequest,
  path: string[],
  database: Awaited<ReturnType<typeof db>>,
  user: User,
): Promise<Response | null> {
  const route = path.join("/"),
    method = request.method;
  if (route === "auth/me" && method === "GET")
    return json({ user: publicUser(user) });
  if (route === "auth/logout" && method === "POST") {
    await database.query("DELETE FROM sessions WHERE token_hash=$1", [
      hash(request.cookies.get(cookieName())?.value || ""),
    ]);
    const response = json({ ok: true });
    response.cookies.set(cookieName(), "", {
      httpOnly: true,
      secure: config().production,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  }
  if (route === "auth/password" && method === "POST") {
    const input = z
      .object({ current: z.string().max(128), password: passwordSchema })
      .parse(await body(request));
    await rateLimit(`password:${user.id}`, 5, 900);
    const [record] = await database.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id=$1",
      [user.id],
    );
    invariant(
      await checkPassword(input.current, record.password_hash),
      403,
      "Current password is incorrect.",
    );
    const encoded = await hashPassword(input.password);
    await database.transaction(async (tx) => {
      await tx.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        encoded,
        user.id,
      ]);
      await tx.query(
        "DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2",
        [user.id, hash(request.cookies.get(cookieName())?.value || "")],
      );
      await audit(user.id, null, "auth.password_changed", {}, tx);
    });
    return json({ ok: true });
  }
  if (route === "auth/mfa/start" && method === "POST") {
    invariant(
      !user.totp_secret,
      409,
      "Two-factor authentication is already enabled.",
    );
    const totp = new OTPAuth.TOTP({
      issuer: "Brilliancy Research",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret({ size: 20 }),
    });
    await database.query("UPDATE users SET totp_pending=$1 WHERE id=$2", [
      encrypt(totp.secret.base32),
      user.id,
    ]);
    return json({
      qr: await QRCode.toDataURL(totp.toString()),
      secret: totp.secret.base32,
    });
  }
  if (route === "auth/mfa/confirm" && method === "POST") {
    await rateLimit(`mfa:${user.id}`, 8, 900);
    const { code } = z
      .object({ code: z.string().length(6) })
      .parse(await body(request));
    const [record] = await database.query<{ totp_pending: string }>(
      "SELECT totp_pending FROM users WHERE id=$1",
      [user.id],
    );
    invariant(record.totp_pending, 400, "Start authenticator setup first.");
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(decrypt(record.totp_pending)),
      period: 30,
      digits: 6,
    });
    invariant(
      totp.validate({ token: code, window: 1 }) !== null,
      400,
      "The authenticator code is incorrect.",
    );
    await database.query(
      "UPDATE users SET totp_secret=totp_pending,totp_pending=NULL WHERE id=$1",
      [user.id],
    );
    await audit(user.id, null, "auth.mfa_enabled");
    return json({ ok: true });
  }
  if (route === "integrations" && method === "GET") {
    return json({
      ai: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL),
      email: !!process.env.EMAIL_FROM,
      storage: config().bucket ? "s3" : "local",
      scanner: !!process.env.CLAMAV_HOST,
      database:
        config().databaseUrl || process.env.DATABASE_SECRET_ARN
          ? "postgresql"
          : "embedded",
      production: config().production,
    });
  }
  if (route === "settings" && method === "GET") {
    const [row] = await database.query<{ value: unknown }>(
      "SELECT value FROM settings WHERE key='agency'",
    );
    return json(row?.value || { name: "Brilliancy Research" });
  }
  if (route === "settings" && method === "PUT") {
    requireAdmin(user);
    const input = z
      .object({ name: z.string().trim().min(1).max(100) })
      .parse(await body(request));
    await database.query(
      "INSERT INTO settings(key,value) VALUES('agency',$1) ON CONFLICT(key) DO UPDATE SET value=$1",
      [JSON.stringify(input)],
    );
    await audit(user.id, null, "settings.updated");
    return json({ ok: true });
  }
  if (route === "users" && method === "GET") {
    requireAdmin(user);
    return json({
      users: await database.query(
        "SELECT id,email,name,role,disabled,created_at,(totp_secret IS NOT NULL) AS mfa_enabled FROM users ORDER BY created_at DESC",
      ),
    });
  }
  if (route === "users" && method === "POST") {
    requireAdmin(user);
    const input = z
      .object({
        name: z.string().trim().min(1).max(100),
        email: emailSchema,
        role: z.enum(["admin", "client"]),
      })
      .strict()
      .parse(await body(request));
    const id = randomUUID(),
      secret = token();
    await database.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO users(id,email,name,role) VALUES($1,$2,$3,$4)",
        [id, input.email, input.name, input.role],
      );
      await tx.query(
        "INSERT INTO account_tokens(token_hash,user_id,kind,expires_at) VALUES($1,$2,'invite',now()+interval '48 hours')",
        [hash(secret), id],
      );
      await audit(
        user.id,
        null,
        "user.invited",
        { userId: id, role: input.role },
        tx,
      );
    });
    const link = `${config().appUrl}/accept?token=${secret}`;
    let emailed = false;
    if (process.env.EMAIL_FROM) {
      try {
        await sendEmail(
          input.email,
          "Your Brilliancy Research account",
          `You have been invited to Brilliancy Research. Create your password using this link within 48 hours:\n\n${link}`,
        );
        emailed = true;
      } catch {
        /* The administrator receives the working invitation link for manual delivery. */
      }
    }
    return json({ id, link, emailed }, 201);
  }
  if (path[0] === "users" && path.length === 2 && method === "PATCH") {
    requireAdmin(user);
    const id = idSchema.parse(path[1]);
    invariant(id !== user.id, 400, "You cannot disable your own account.");
    const { disabled } = z
      .object({ disabled: z.boolean() })
      .parse(await body(request));
    await database.transaction(async (tx) => {
      await tx.query("UPDATE users SET disabled=$1 WHERE id=$2", [
        disabled,
        id,
      ]);
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [id]);
      await audit(
        user.id,
        null,
        disabled ? "user.disabled" : "user.enabled",
        { userId: id },
        tx,
      );
    });
    return json({ ok: true });
  }
  if (path[0] === "users" && path[2] === "invite" && method === "POST") {
    requireAdmin(user);
    const id = idSchema.parse(path[1]);
    const [target] = await database.query(
      "SELECT id FROM users WHERE id=$1 AND disabled=false",
      [id],
    );
    invariant(target, 404, "Account not found.");
    const secret = token();
    await database.transaction(async (tx) => {
      await tx.query("DELETE FROM account_tokens WHERE user_id=$1", [id]);
      await tx.query(
        "INSERT INTO account_tokens(token_hash,user_id,kind,expires_at) VALUES($1,$2,'invite',now()+interval '48 hours')",
        [hash(secret), id],
      );
      await audit(
        user.id,
        null,
        "user.access_link_created",
        { userId: id },
        tx,
      );
    });
    return json({ link: `${config().appUrl}/accept?token=${secret}` });
  }

  return null;
}
