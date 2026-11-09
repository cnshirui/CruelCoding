import Link from "next/link";
import { getSession } from "@/lib/auth";
import { logout } from "@/app/auth/actions";

export async function AuthNav() {
  const user = await getSession().catch(() => null);
  const authenticated = Boolean(user);
  const username = user?.name || user?.email.split("@")[0] || "用户";

  return (
    <div className="nav-actions">
      <a className="nav-link" href="https://leetcode.com" target="_blank" rel="noreferrer">LeetCode ↗</a>
      {authenticated ? <>
        <Link className="nav-link" href="/account">{username}</Link>
        <form action={logout}><button className="nav-button" type="submit">退出登录</button></form>
      </> : <>
        <Link className="nav-button" href="/login">Log in</Link>
      </>}
    </div>
  );
}
