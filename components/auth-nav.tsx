import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";

export async function AuthNav() {
  let authenticated = false;
  let username = "用户";
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    authenticated = Boolean(data?.claims?.sub);
    if (authenticated) {
      const { data: { user } } = await supabase.auth.getUser();
      const metadata = user?.user_metadata as Record<string, unknown> | undefined;
      const metadataName = [metadata?.full_name, metadata?.name, metadata?.preferred_username, metadata?.user_name].find((value): value is string => typeof value === "string" && value.trim().length > 0);
      username = metadataName?.trim() || user?.email?.split("@")[0] || username;
    }
  } catch {}

  return (
    <div className="nav-actions">
      <a className="nav-link" href="https://leetcode.com" target="_blank" rel="noreferrer">LeetCode ↗</a>
      {authenticated ? <>
        <Link className="nav-link" href="/account">{username}</Link>
        <form action={logout}><button className="nav-button" type="submit">退出登录</button></form>
      </> : <>
        <Link className="nav-link" href="/login?mode=signup">Sign up</Link>
        <Link className="nav-button" href="/login">Log in</Link>
      </>}
    </div>
  );
}
