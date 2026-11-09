import Link from "next/link";
import { loginWithGoogle } from "@/app/auth/actions";

export function AuthForm({ error, message, next }: { error?: string; message?: string; next?: string }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand auth-brand" href="/"><span className="brand-mark">C</span><span>Cruel Coding</span></Link>
        <div className="auth-copy">
          <p className="eyebrow">WELCOME</p>
          <h1>Log in.</h1>
          <p>Sign in to Cruel Coding with your Google account.</p>
        </div>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" action={loginWithGoogle}>
          <input name="next" type="hidden" value={next ?? ""} />
          <Link className="auth-back-link" href="/">← Back to rankings</Link>
          <h2>Log in</h2>
          {error ? <p className="form-alert error" role="alert">{error}</p> : null}
          {message ? <p className="form-alert success" role="status">{message}</p> : null}
          <button className="google-button" type="submit">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path fill="#4285f4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
              <path fill="#34a853" d="M12 22c2.7 0 4.98-.9 6.63-2.37l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
              <path fill="#fbbc05" d="M6.39 13.92A6.02 6.02 0 0 1 6.07 12c0-.67.11-1.32.32-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.54l3.35-2.62Z" />
              <path fill="#ea4335" d="M12 5.95c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z" />
            </svg>
            Continue with Google
          </button>
        </form>
      </section>
    </main>
  );
}
