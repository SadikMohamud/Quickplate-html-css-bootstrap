"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/Logo";
import { getBrowserClient } from "@/lib/supabase/client";
import { theme } from "@/lib/theme";

// Two ways in, both on the same account.
//
// A six digit code by email is the default and the only thing a customer
// ever needs: no password to choose, forget or reset, and it works on a
// phone at the counter where a magic link would open in another browser
// and lose the installed app's session.
//
// A password is there for the people who sign in every shift on the same
// counter device, where typing a code from an inbox each time is friction.
// Anyone who has set one in Account can use it.
type Mode = "code" | "password";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("code");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function done() {
    router.replace("/");
    router.refresh();
  }

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
    done();
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await getBrowserClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      setError(
        "That email and password did not match. If you have not set a password yet, sign in with a code instead."
      );
      return;
    }
    done();
  }

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setSent(false);
    setCode("");
    setPassword("");
  }

  const inputClasses =
    "w-full rounded-xl border border-brand-accent/40 bg-brand-surface px-4 py-3 outline-none focus:border-brand-accent";
  const buttonClasses =
    "w-full rounded-xl bg-brand py-3 font-medium text-brand-on-primary disabled:opacity-50";
  const linkClasses =
    "text-sm text-brand-muted underline underline-offset-2 hover:text-brand";

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

      {mode === "password" ? (
        <form onSubmit={signInWithPassword} className="flex flex-col gap-3">
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
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClasses}
            required
          />
          <button type="submit" disabled={busy} className={buttonClasses}>
            {busy ? "Please wait..." : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => switchTo("code")}
            className={linkClasses}
          >
            Email me a code instead
          </button>
        </form>
      ) : sent ? (
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
            className={linkClasses}
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
          <button
            type="button"
            onClick={() => switchTo("password")}
            className={linkClasses}
          >
            Sign in with a password
          </button>
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
