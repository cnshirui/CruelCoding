"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminDb, createSessionToken, hashPassword, safeNext, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from "@/lib/auth";

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}

function readForm(form: FormData) {
  return {
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    password: String(form.get("password") ?? ""),
    next: safeNext(String(form.get("next") ?? "")),
  };
}

function fail(message: string, next: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`);
}

async function signIn(user: { id: string; email: string; name: string; role: string }, next: string): Promise<never> {
  (await cookies()).set(SESSION_COOKIE, createSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role }), sessionCookieOptions);
  redirect(next);
}

// ponytail: no rate limiting or email verification; scrypt slows guessing. Add both if abuse shows up.
export async function loginWithPassword(form: FormData) {
  const { email, password, next } = readForm(form);
  const db = adminDb();
  const { data: user } = await db.from("app_users").select("id,email,name,role,password_hash").eq("email", email).maybeSingle();
  if (!(await verifyPassword(password, user?.password_hash)) || !user) fail("Wrong email or password.", next);
  await db.from("app_users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);
  await signIn(user, next);
}

export async function registerWithPassword(form: FormData) {
  const { email, password, next } = readForm(form);
  if (!/^\S+@\S+\.\S+$/.test(email)) fail("Enter a valid email address.", next);
  if (password.length < 8) fail("Password must be at least 8 characters.", next);
  const { data: user, error } = await adminDb().from("app_users")
    .insert({ email, name: email.split("@")[0], password_hash: await hashPassword(password), last_login_at: new Date().toISOString() })
    .select("id,email,name,role").single();
  // 23505 = unique violation: never attach a password to an existing (e.g. seeded or Google) account.
  if (error?.code === "23505") fail("This email is already registered. Log in instead.", next);
  if (error || !user) fail("Your account could not be created.", next);
  await signIn(user, next);
}
