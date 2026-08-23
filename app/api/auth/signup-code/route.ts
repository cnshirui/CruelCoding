import { NextResponse } from "next/server";
import { sendSignupActivationCode } from "@/lib/signup-activation";

export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({ email: "" })) as { email?: string };
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  try {
    await sendSignupActivationCode(normalized);
    return NextResponse.json({ message: "Activation code sent. Check your email." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activation email could not be sent.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Please wait") ? 429 : 500 });
  }
}
