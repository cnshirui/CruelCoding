import "server-only";

import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const CODE_TTL_MINUTES = 10;
const RESEND_SECONDS = 60;

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

function emailHash(email: string) {
  return createHash("sha256").update(normalizedEmail(email)).digest("hex");
}

function codeHash(email: string, code: string) {
  const secret = process.env.SIGNUP_CODE_SECRET ?? process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Signup activation is not configured.");
  return createHmac("sha256", secret).update(`${normalizedEmail(email)}:${code}`).digest("hex");
}

export function signupAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Signup activation is not configured.");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function sendSignupActivationCode(email: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error("Email delivery is not configured.");
  const database = signupAdminClient();
  const key = emailHash(email);
  const { data: existing, error: lookupError } = await database.from("signup_activation_codes").select("sent_at").eq("email_hash", key).maybeSingle();
  if (lookupError) throw new Error("Activation service is unavailable.");
  if (existing && Date.now() - new Date(existing.sent_at).getTime() < RESEND_SECONDS * 1_000) throw new Error("Please wait one minute before requesting another code.");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();
  const { error: storeError } = await database.from("signup_activation_codes").upsert({ email_hash: key, code_hash: codeHash(email, code), expires_at: expiresAt, sent_at: new Date().toISOString(), attempts: 0 });
  if (storeError) throw new Error("Activation service is unavailable.");

  const resend = new Resend(resendKey);
  const { error: sendError } = await resend.emails.send({
    from: "Cruel Coding <support@cruelcoding.com>",
    to: [normalizedEmail(email)],
    subject: `${code} is your Cruel Coding activation code`,
    text: `Your Cruel Coding activation code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. If you did not request this code, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px"><h1 style="font-size:24px">Activate your Cruel Coding account</h1><p>Enter this code to finish creating your account:</p><p style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:8px;margin:28px 0">${code}</p><p style="color:#666">This code expires in ${CODE_TTL_MINUTES} minutes. If you did not request it, you can ignore this email.</p></div>`,
  });
  if (sendError) {
    console.error("[signup-activation] Resend rejected activation email", {
      name: sendError.name,
      message: sendError.message,
    });
    await database.from("signup_activation_codes").delete().eq("email_hash", key);

    const message = sendError.message.toLowerCase();
    if (message.includes("domain") || message.includes("verify")) {
      throw new Error("support@cruelcoding.com is not verified in Resend. Verify cruelcoding.com and try again.");
    }
    if (message.includes("api key") || message.includes("unauthorized") || message.includes("permission")) {
      throw new Error("The Resend API key is invalid or does not have permission to send email.");
    }
    if (message.includes("rate") || message.includes("too many")) {
      throw new Error("Too many email requests. Please wait and try again.");
    }
    throw new Error("Activation email could not be sent. Check the server log for the Resend error.");
  }
}

export async function consumeSignupActivationCode(email: string, code: string) {
  if (!/^\d{6}$/.test(code)) return false;
  const database = signupAdminClient();
  const key = emailHash(email);
  const { data, error } = await database.from("signup_activation_codes").select("code_hash,expires_at,attempts").eq("email_hash", key).maybeSingle();
  if (error || !data || data.attempts >= 5 || new Date(data.expires_at).getTime() < Date.now()) return false;
  await database.from("signup_activation_codes").update({ attempts: data.attempts + 1 }).eq("email_hash", key);
  const expected = Buffer.from(data.code_hash, "hex");
  const actual = Buffer.from(codeHash(email, code), "hex");
  const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (valid) await database.from("signup_activation_codes").delete().eq("email_hash", key);
  return valid;
}
