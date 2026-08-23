import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; mode?: string; next?: string }> }) {
  const { error, message, mode, next } = await searchParams;
  return <AuthForm error={error} message={message} mode={mode === "signup" ? "signup" : "login"} next={next} />;
}
