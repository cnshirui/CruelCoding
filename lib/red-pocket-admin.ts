import { createSupabaseServerClient } from "@/lib/supabase/server";

// The group owner(s) who may mark red pockets as sent, e.g. RED_POCKET_ADMIN_EMAILS=a@x.com,b@y.com,
// plus any user whose app_metadata.role is "sys_admin" (set with the Supabase admin API).
export async function isRedPocketAdmin() {
  const admins = (process.env.RED_POCKET_ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.app_metadata?.role === "sys_admin") return true;
    const email = typeof data?.claims?.email === "string" ? data.claims.email.toLowerCase() : "";
    return admins.includes(email);
  } catch {
    return false;
  }
}
