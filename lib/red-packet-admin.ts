import { createSupabaseServerClient } from "@/lib/supabase/server";

// The group owner(s) who may mark red packets as sent, e.g. RED_PACKET_ADMIN_EMAILS=a@x.com,b@y.com
export async function isRedPacketAdmin() {
  const admins = (process.env.RED_PACKET_ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (!admins.length) return false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const email = typeof data?.claims?.email === "string" ? data.claims.email.toLowerCase() : "";
    return admins.includes(email);
  } catch {
    return false;
  }
}
