"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { consumeSignupActivationCode, signupAdminClient } from "@/lib/signup-activation";

function credentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Enter a valid email address." } as const;
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." } as const;
  return { ok: true, email, password } as const;
}

function safeNext(formData: FormData) {
  const requestedNext = String(formData.get("next") ?? "");
  return requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/account";
}

function authError(message: string, mode?: "signup", next?: string): never {
  const params = new URLSearchParams();
  if (mode) params.set("mode", mode);
  if (next && next !== "/account") params.set("next", next);
  params.set("error", message);
  redirect(`/login?${params.toString()}`);
}

export async function signup(formData: FormData) {
  const input = credentials(formData);
  if (!input.ok) authError(input.error, "signup");
  if (input.password !== String(formData.get("confirmPassword") ?? "")) authError("Passwords do not match.", "signup");
  const activationCode = String(formData.get("activationCode") ?? "").trim();
  const activated = await consumeSignupActivationCode(input.email, activationCode).catch(() => false);
  if (!activated) authError("The activation code is invalid or expired.", "signup");
  const admin = signupAdminClient();
  const { error: createError } = await admin.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true });
  if (createError) authError(createError.message.includes("already") ? "An account with this email already exists." : "Account creation failed.", "signup");
  const supabase = await createSupabaseServerClient().catch(() => authError("Your account was created. Please log in."));
  const { error: loginError } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (loginError) redirect(`/login?message=${encodeURIComponent("Your account is active. Please log in.")}`);
  redirect("/account");
}

export async function login(formData: FormData) {
  const next = safeNext(formData);
  const input = credentials(formData);
  if (!input.ok) authError(input.error, undefined, next);
  const supabase = await createSupabaseServerClient().catch(() => authError("Authentication is not configured yet.", undefined, next));
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error) authError("Email or password is incorrect.", undefined, next);
  redirect(next);
}

export async function loginWithGoogle(formData: FormData) {
  const next = safeNext(formData);
  const supabase = await createSupabaseServerClient().catch(() => authError("Authentication is not configured yet.", undefined, next));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!siteUrl) authError("Authentication is not configured yet.", undefined, next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) authError("Google login could not be started.", undefined, next);
  redirect(data.url);
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
