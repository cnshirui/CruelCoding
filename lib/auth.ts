import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const SESSION_COOKIE = "cc_session";
export const OAUTH_COOKIE = "cc_oauth";

export function safeNext(value: string | null | undefined) {
  // Same-origin paths only: no "//host", no "/\\host" (browsers treat \ as /), no whitespace/control chars.
  return value && /^\/(?![/\\])[^\\\s]*$/.test(value) ? value : "/account";
}
const SESSION_DAYS = 30;

export type SessionUser = { id: string; email: string; name: string; role: string };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  return value;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

// ponytail: stateless signed cookie with no server-side revocation (admin checks re-read the
// role from app_users). Add a sessions table if forced logout is ever needed.
export function createSessionToken(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + SESSION_DAYS * 86_400_000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const { exp, id, email, name, role } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof exp === "number" && exp > Date.now() ? { id, email, name, role } : null;
  } catch {
    return null;
  }
}

export const getSession = cache(async () => readSessionToken((await cookies()).get(SESSION_COOKIE)?.value));

export const sessionCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_DAYS * 86_400 };

// Server-only database client. Every caller checks getSession() first; RLS no longer knows the user.
export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase admin access is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// The group owner(s): RED_POCKET_ADMIN_EMAILS=a@x.com,b@y.com, plus any app_users.role = "sys_admin".
// Role is read from the database, not the cookie, so revoking it takes effect immediately.
export const isAdmin = cache(async () => {
  const session = await getSession();
  if (!session) return false;
  const admins = (process.env.RED_POCKET_ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const { data } = await adminDb().from("app_users").select("email,role").eq("id", session.id).maybeSingle();
  return Boolean(data && (data.role === "sys_admin" || admins.includes(data.email)));
});
