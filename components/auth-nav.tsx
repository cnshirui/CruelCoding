import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";

export async function AuthNav() {
  let authenticated = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    authenticated = Boolean(data?.claims?.sub);
  } catch {}

  return (
    <div className="nav-actions">
      <a className="nav-link" href="https://leetcode.com" target="_blank" rel="noreferrer">LeetCode ↗</a>
      {authenticated ? <>
        <Link className="nav-link" href="/account">个人资料</Link>
        <form action={logout}><button className="nav-button" type="submit">退出登录</button></form>
      </> : <>
        <Link className="nav-link" href="/login?mode=signup">Sign up</Link>
        <Link className="nav-button" href="/login">Log in</Link>
      </>}
    </div>
  );
}
