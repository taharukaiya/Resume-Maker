import { config } from "@/lib/config";
import {
  checkPassword,
  decrypt,
  hash,
  hashPassword,
  token,
} from "@/lib/crypto";
import { db, type Sql } from "@/lib/db";
import { AppError, invariant } from "@/lib/errors";
import { randomUUID } from "node:crypto";
import * as OTPAuth from "otpauth";
export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "client";
  disabled: boolean;
  totp_secret: string | null;
  totp_last_step: string | null;
};
export type PublicUser = Pick<User, "id" | "email" | "name" | "role"> & {
  mfaEnabled: boolean;
};
export function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mfaEnabled: !!user.totp_secret,
  };
}
export async function audit(
  actorId: string | null,
  siteId: string | null,
  action: string,
  details: unknown = {},
  sql?: Sql,
) {
  await (sql || (await db())).query(
    "INSERT INTO audit_events(id,actor_id,site_id,action,details) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), actorId, siteId, action, JSON.stringify(details)],
  );
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const database = await db();
  const result = await database.query<{ count: number }>(
    `INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END, expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+$2*interval '1 second' ELSE rate_limits.expires_at END RETURNING count`,
    [hash(key), seconds],
  );
  invariant(
    result[0].count <= limit,
    429,
    "Too many attempts. Please wait before trying again.",
  );
}
export async function getSession(rawToken?: string): Promise<User | null> {
  if (!rawToken) return null;
  const rows = await (
    await db()
  ).query<User>(
    "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.disabled=false",
    [hash(rawToken)],
  );
  return rows[0] || null;
}
export async function login(email: string, password: string, code: string) {
  await rateLimit(`login:${email.toLowerCase()}`, 8, 900);
  const database = await db();
  const rows = await database.query<User & { password_hash: string }>(
    "SELECT * FROM users WHERE email=$1",
    [email.toLowerCase()],
  );
  const user = rows[0];
  // Always perform a password derivation, including unknown accounts.
  const valid = user?.password_hash
    ? await checkPassword(password, user.password_hash)
    : (await hashPassword(password), false);
  invariant(
    user && valid && !user.disabled,
    401,
    "Email or password is incorrect.",
  );
  if (user.totp_secret) {
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(decrypt(user.totp_secret)),
      period: 30,
      digits: 6,
    });
    const delta = totp.validate({ token: code, window: 1 });
    invariant(delta !== null, 401, "Enter a valid authenticator code.");
    const step = Math.floor(Date.now() / 30000) + delta;
    const accepted = await database.query(
      "UPDATE users SET totp_last_step=$1 WHERE id=$2 AND (totp_last_step IS NULL OR totp_last_step<$1) RETURNING id",
      [step, user.id],
    );
    invariant(
      accepted.length,
      401,
      "This authenticator code was already used. Wait for the next code.",
    );
  }
  const session = token();
  await database.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
      [hash(session), user.id],
    );
    await audit(user.id, null, "auth.login", {}, tx);
  });
  return { user: publicUser(user), session };
}
export async function initialize(input: {
  token: string;
  name: string;
  email: string;
  password: string;
  agencyName: string;
}) {
  invariant(
    process.env.SETUP_TOKEN &&
      hash(input.token) === hash(process.env.SETUP_TOKEN),
    403,
    "The setup link is invalid. Run npm run setup.",
  );
  const passwordHash = await hashPassword(input.password);
  const database = await db();
  await database.transaction(async (tx) => {
    await tx.query("LOCK TABLE users IN EXCLUSIVE MODE");
    const users = await tx.query("SELECT id FROM users LIMIT 1");
    invariant(
      !users.length,
      409,
      "Setup is already complete. Sign in instead.",
    );
    const id = randomUUID();
    await tx.query(
      "INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,'admin')",
      [id, input.email.toLowerCase(), input.name, passwordHash],
    );
    await tx.query("INSERT INTO settings(key,value) VALUES('agency',$1)", [
      JSON.stringify({ name: input.agencyName }),
    ]);
    await audit(id, null, "platform.initialized", {}, tx);
  });
}
export function requireAdmin(user: User) {
  if (user.role !== "admin")
    throw new AppError(403, "Administrator access required.");
}
export async function siteAccess(user: User, id: string, sql?: Sql) {
  const rows = await (sql || (await db())).query<{
    id: string;
    client_id: string | null;
  }>("SELECT id,client_id FROM sites WHERE id=$1", [id]);
  invariant(
    rows[0] && (user.role === "admin" || rows[0].client_id === user.id),
    404,
    "Portfolio not found.",
  );
}
