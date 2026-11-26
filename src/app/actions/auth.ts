"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";

export type AuthState = { error?: string; fields?: Record<string, string> } | undefined;

const safeNext = (n: FormDataEntryValue | null) => {
  const s = typeof n === "string" ? n : "/";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
};

const RegisterSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name").max(40),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/, "Username: 3–20 letters, numbers or _"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function register(_: AuthState, form: FormData): Promise<AuthState> {
  const raw = Object.fromEntries(["displayName", "username", "email", "password"].map((k) => [k, String(form.get(k) ?? "")]));
  const parsed = RegisterSchema.safeParse(raw);
  const fields = { displayName: raw.displayName, username: raw.username, email: raw.email };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const { displayName, username, email, password } = parsed.data;
  if (await db.get(`SELECT 1 FROM users WHERE username = ?`, username)) return { error: "That username is taken", fields };
  if (await db.get(`SELECT 1 FROM users WHERE email = ?`, email)) return { error: "An account with that email already exists", fields };
  const hue = Math.floor(Math.random() * 360);
  const r = await db.get<{ id: number }>(
    `INSERT INTO users (username, display_name, email, password_hash, avatar_hue) VALUES (?,?,?,?,?) RETURNING id`,
    username, displayName, email, hashPassword(password), hue,
  );
  await createSession(r!.id);
  redirect(safeNext(form.get("next")) === "/" ? "/recommendations?welcome=1" : safeNext(form.get("next")));
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const id = String(form.get("identifier") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const u = await db.get<{ id: number; password_hash: string | null }>(
    `SELECT id, password_hash FROM users WHERE email = ? OR username = ?`, id, id,
  );
  if (!u || !verifyPassword(password, u.password_hash)) return { error: "Incorrect email/username or password", fields: { identifier: id } };
  await createSession(u.id);
  redirect(safeNext(form.get("next")));
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
