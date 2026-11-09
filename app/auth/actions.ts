"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(formData: FormData) {
  const requestedNext = String(formData.get("next") ?? "");
  return requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/account";
}

function authError(message: string, next?: string): never {
  const params = new URLSearchParams();
  if (next && next !== "/account") params.set("next", next);
  params.set("error", message);
  redirect(`/login?${params.toString()}`);
}

export async function loginWithGoogle(formData: FormData) {
  const next = safeNext(formData);
  const supabase = await createSupabaseServerClient().catch(() => authError("Authentication is not configured yet.", next));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!siteUrl) authError("Authentication is not configured yet.", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) authError("Google login could not be started.", next);
  redirect(data.url);
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
