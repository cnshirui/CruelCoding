import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { adminDb, createSessionToken, OAUTH_COOKIE, safeNext, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

type GoogleClaims = { iss: string; aud: string; sub: string; email?: string; email_verified?: boolean; name?: string; exp: number };

function fail(request: NextRequest, message: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url));
  response.cookies.delete({ name: OAUTH_COOKIE, path: "/auth/google" });
  return response;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!clientId || !clientSecret || !siteUrl) return fail(request, "Google login is not configured.");

  let saved: { state?: string; next?: string } = {};
  try { saved = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? "{}"); } catch {}
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const code = request.nextUrl.searchParams.get("code");
  if (!code || !saved.state || state.length !== saved.state.length || !timingSafeEqual(Buffer.from(state), Buffer.from(saved.state))) {
    return fail(request, "Google login expired. Please try again.");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${siteUrl}/auth/google/callback`, grant_type: "authorization_code" }),
    cache: "no-store",
  });
  if (!tokenResponse.ok) return fail(request, "Google login could not be completed.");
  const { id_token: idToken } = await tokenResponse.json() as { id_token?: string };

  // The ID token came straight from Google's token endpoint over TLS, so its signature need not
  // be re-verified (OpenID Connect Core 3.1.3.7); the issuer, audience and expiry still are.
  let claims: GoogleClaims;
  try { claims = JSON.parse(Buffer.from(idToken?.split(".")[1] ?? "", "base64url").toString("utf8")); }
  catch { return fail(request, "Google login could not be completed."); }
  const email = claims.email?.toLowerCase();
  if (!["https://accounts.google.com", "accounts.google.com"].includes(claims.iss) || claims.aud !== clientId || claims.exp * 1000 < Date.now() || !claims.sub || !email || !claims.email_verified) {
    return fail(request, "Google account could not be verified.");
  }

  const db = adminDb();
  const columns = "id,email,name,role,google_sub";
  const { data: bySub } = await db.from("app_users").select(columns).eq("google_sub", claims.sub).maybeSingle();
  const { data: byEmail } = bySub ? { data: null } : await db.from("app_users").select(columns).eq("email", email).maybeSingle();
  // Link by email only to an account no Google identity has claimed yet.
  if (byEmail?.google_sub && byEmail.google_sub !== claims.sub) return fail(request, "This email is linked to a different Google account.");
  const existing = bySub ?? byEmail;
  const name = existing?.name || claims.name?.trim() || email.split("@")[0];
  const { data: user, error } = existing
    ? await db.from("app_users").update({ google_sub: claims.sub, email, name, last_login_at: new Date().toISOString() }).eq("id", existing.id).select(columns).single()
    : await db.from("app_users").insert({ google_sub: claims.sub, email, name, last_login_at: new Date().toISOString() }).select(columns).single();
  if (error || !user) return fail(request, "Your account could not be saved.");

  const response = NextResponse.redirect(new URL(safeNext(saved.next ?? null), request.url));
  response.cookies.set(SESSION_COOKIE, createSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role }), sessionCookieOptions);
  response.cookies.delete({ name: OAUTH_COOKIE, path: "/auth/google" });
  return response;
}
