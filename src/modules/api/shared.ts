import { config } from "@/lib/config";
import { AppError, invariant } from "@/lib/errors";
import { getSession } from "@/modules/auth/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
export const cookieName = () =>
  config().production ? "__Host-brilliancy_session" : "brilliancy_session";
export const emailSchema = z
  .email()
  .max(254)
  .transform((s) => s.toLowerCase());
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128);
export const idSchema = z.uuid();
export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function readLimited(request: Request, max: number) {
  invariant(
    Number(request.headers.get("content-length") || 0) <= max,
    413,
    "The request is too large.",
  );
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new AppError(413, "The request is too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function body(request: Request, max = 2 * 1024 * 1024) {
  try {
    return JSON.parse(Buffer.from(await readLimited(request, max)).toString());
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "Invalid JSON request.");
  }
}
export function checkOrigin(request: Request) {
  invariant(
    request.headers.get("origin") === new URL(config().appUrl).origin,
    403,
    "Request origin is not allowed.",
  );
}
export async function requireUser(request: NextRequest) {
  const user = await getSession(request.cookies.get(cookieName())?.value);
  invariant(user, 401, "Please sign in to continue.");
  return user;
}
