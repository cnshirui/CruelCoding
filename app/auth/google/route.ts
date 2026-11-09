import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE, safeNext } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!clientId || !siteUrl) return NextResponse.redirect(new URL("/login?error=Google%20login%20is%20not%20configured.", request.url));

  const state = randomBytes(24).toString("base64url");
  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${siteUrl}/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();

  const response = NextResponse.redirect(authorize);
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, next: safeNext(request.nextUrl.searchParams.get("next")) }), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/auth/google", maxAge: 600,
  });
  return response;
}
