"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/Logo";
import { getBrowserClient } from "@/lib/supabase/client";
import { theme } from "@/lib/theme";

// Passwordless sign in. Supabase emails a six digit code, the customer
// types it back, and the same flow creates the account on a first visit.
// A code beats a magic link at the counter, because a link often opens in
// a different browser and loses the installed app's session.
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await getBrowserClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await getBrowserClient().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (err) {
      setError(
        "That code did not work. Check the latest email, or send a new code."
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  const inputClasses =
    "w-full rounded-xl border border-brand-accent/40 bg-brand-surface px-4 py-3 outline-none focus:border-brand-accent";
  const buttonClasses =
    "w-full rounded-xl bg-brand py-3 font-medium text-brand-on-primary disabled:opacity-50";

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-10">
      <div className="text-center">
        <Link
          href="/install"
          className="mb-6 inline-block rounded-full bg-brand/10 px-4 py-1.5 text-xs font-medium text-brand hover:bg-brand/20"
        >
          Add this app to your phone
        </Link>
        <Logo className="mx-auto mb-4 h-20 w-auto" priority />
        <p className="text-sm font-medium text-brand">{theme.tagline}</p>
        <p className="mt-1 text-sm text-brand-muted">{theme.descriptor}</p>
      </div>

      {sent ? (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <p className="text-center text-sm text-brand-muted">
            We have emailed a six digit code to{" "}
            <span className="font-medium text-brand">{email}</span>.
          </p>
          <label className="text-sm font-medium" htmlFor="code">
            Your code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputClasses} text-center text-xl tracking-[0.4em]`}
            required
            autoFocus
          />
          <button type="submit" disabled={busy} className={buttonClasses}>
            {busy ? "Please wait..." : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setCode("");
              setError(null);
            }}
            className="text-sm text-brand-muted underline underline-offset-2 hover:text-brand"
          >
            Use a different email
          </button>
        </form>
      ) : (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClasses}
            required
          />
          <button type="submit" disabled={busy} className={buttonClasses}>
            {busy ? "Sending..." : "Email me a code"}
          </button>
          <p className="text-center text-xs text-brand-muted">
            No password needed. First time here? This creates your card.
          </p>
        </form>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
