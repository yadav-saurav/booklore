import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import crypto from "node:crypto";
import { db } from "@/db";

const COOKIE = "bl_session";
const TTL_DAYS = 30;

export type SessionUser = { id: number; username: string; displayName: string; avatarHue: number };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return ["scrypt", salt, hash].join(":");
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [, salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  const known = Buffer.from(hash, "hex");
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = Math.floor(Date.now() / 1000) + TTL_DAYS * 86400;
  await db.run(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)`, sha(token), userId, expires);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.BOOKLORE_INSECURE_COOKIES !== "1",
    path: "/",
    expires: new Date(expires * 1000),
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.run(`DELETE FROM sessions WHERE id = ?`, sha(token));
  jar.delete(COOKIE);
}

/** Current user (memoised per request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = await db.get<SessionUser>(
    `SELECT u.id, u.username, u.display_name displayName, u.avatar_hue avatarHue
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > unixepoch()`,
    sha(token),
  );
  return row ?? null;
});

export class AuthRequiredError extends Error {
  constructor() {
    super("Sign in required");
  }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new AuthRequiredError();
  return u;
}
