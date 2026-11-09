import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const { error, message, next } = await searchParams;
  return <AuthForm error={error} message={message} next={next} />;
}
