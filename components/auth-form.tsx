"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { login, loginWithGoogle, signup } from "@/app/auth/actions";

export function AuthForm({ error, message, mode = "login", next }: { error?: string; message?: string; mode?: "login" | "signup"; next?: string }) {
  const signingUp = mode === "signup";
  const formRef = useRef<HTMLFormElement>(null);
  const [codeStatus, setCodeStatus] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  async function sendCode() {
    if (!formRef.current) return;
    const email = String(new FormData(formRef.current).get("email") ?? "").trim();
    setSendingCode(true); setCodeStatus(""); setCodeError(false);
    try {
      const response = await fetch("/api/auth/signup-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error ?? "Activation email could not be sent.");
      setCodeStatus(result.message ?? "Activation code sent.");
    } catch (requestError) {
      setCodeError(true); setCodeStatus(requestError instanceof Error ? requestError.message : "Activation email could not be sent.");
    } finally { setSendingCode(false); }
  }
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand auth-brand" href="/"><span className="brand-mark">C</span><span>Cruel Coding</span></Link>
        <div className="auth-copy">
          <p className="eyebrow">{signingUp ? "JOIN THE COMMUNITY" : "WELCOME BACK"}</p>
          <h1>{signingUp ? "Sign up." : "Log in."}</h1>
          <p>{signingUp ? "Create an account with your email address." : "Welcome back to Cruel Coding."}</p>
        </div>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" action={signingUp ? signup : login} ref={formRef}>
          <input name="next" type="hidden" value={next ?? ""} />
          <Link className="auth-back-link" href="/">← Back to rankings</Link>
          <h2>{signingUp ? "Create account" : "Log in"}</h2>
          {error ? <p className="form-alert error" role="alert">{error}</p> : null}
          {message ? <p className="form-alert success" role="status">{message}</p> : null}
          <button className="google-button" formAction={loginWithGoogle} formNoValidate type="submit">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path fill="#4285f4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
              <path fill="#34a853" d="M12 22c2.7 0 4.98-.9 6.63-2.37l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
              <path fill="#fbbc05" d="M6.39 13.92A6.02 6.02 0 0 1 6.07 12c0-.67.11-1.32.32-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.54l3.35-2.62Z" />
              <path fill="#ea4335" d="M12 5.95c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z" />
            </svg>
            Continue with Google
          </button>
          <div className="auth-divider"><span>or use email</span></div>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          {signingUp ? <><div className="activation-row"><label>Activation code<input name="activationCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label><button className="nav-button activation-button" type="button" onClick={sendCode} disabled={sendingCode}>{sendingCode ? "Sending…" : "Send code"}</button></div>{codeStatus ? <p className={`form-alert ${codeError ? "error" : "success"}`} role={codeError ? "alert" : "status"}>{codeStatus}</p> : null}</> : null}
          <label>Password<input name="password" type="password" autoComplete={signingUp ? "new-password" : "current-password"} minLength={8} required /></label>
          {signingUp ? <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label> : null}
          <button className="primary-button" type="submit">{signingUp ? "Create account" : "Log in"}</button>
          <p className="form-switch">{signingUp ? <>Already have an account? <Link href="/login">Log in</Link></> : <>New here? <Link href="/login?mode=signup">Create an account</Link></>}</p>
        </form>
      </section>
    </main>
  );
}
