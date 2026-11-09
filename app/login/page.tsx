import { headers } from "next/headers";
import { AuthForm } from "@/components/auth-form";

// Without an explicit ?next=, return to the same-site page the visitor came from (the nav "Log in" link).
async function refererPath() {
  const list = await headers();
  try {
    const referer = new URL(list.get("referer") ?? "");
    if (referer.host !== list.get("host") || referer.pathname === "/login" || referer.pathname.startsWith("/auth/")) return undefined;
    return `${referer.pathname}${referer.search}`;
  } catch {
    return undefined;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const { error, message, next } = await searchParams;
  return <AuthForm error={error} message={message} next={next || await refererPath()} />;
}
