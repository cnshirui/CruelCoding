import { NextResponse, type NextRequest } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth";

// The contest ranking lookup only redirects to public LeetCode pages, and the public leaderboard links to it.
// Static content pages (group rules, AI agent course list) carry no member data and stay public too.
const PUBLIC_PAGES = new Set(["/", "/ranks", "/api/contest-ranking", "/rules", "/ai-agents", "/login"]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PAGES.has(pathname) || pathname.startsWith("/auth/")) return NextResponse.next();
  if (readSessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
