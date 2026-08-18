"use client";

import Link from "next/link";
import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import SignOutButton from "@/components/SignOutButton";
import { getBrowserClient } from "@/lib/supabase/client";
import { theme } from "@/lib/theme";
import type { Role } from "@/lib/types";

interface AccountViewProps {
  userId: string;
  email: string;
  displayName: string | null;
  role: Role;
}

// Where the header link should point for each role.
const home: Record<Role, { href: string; label: string }> = {
  customer: { href: "/card", label: "My card" },
  staff: { href: "/staff", label: "Staff till" },
  owner: { href: "/owner", label: "Dashboard" },
};

export default function AccountView({
  userId,
  email,
  displayName,
  role,
}: AccountViewProps) {
  const [name, setName] = useState(displayName ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    const { error: err } = await getBrowserClient()
      .from("profiles")
      .update({ display_name: name.trim() || null })
      .eq("id", userId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setMessage("Name saved.");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (password.length < 8) {
      setError("Please choose a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    const { error: err } = await getBrowserClient().auth.updateUser({
      password,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setPassword("");
    setConfirm("");
    setMessage("Password saved. You can now sign in with it, or keep using codes.");
  }

  const inputClasses =
    "w-full rounded-xl border border-brand-accent/40 bg-brand-surface px-4 py-3 outline-none focus:border-brand-accent";
  const submitClasses =
    "mt-1 rounded-xl bg-brand py-3 font-medium text-brand-on-primary disabled:opacity-50";
  const cardClasses = "animate-rise rounded-3xl bg-brand-surface p-6 shadow-sm";
  const dest = home[role];

  return (
    <>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-28 pt-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              {theme.shopName}
            </h1>
            <p className="text-xs text-brand-muted">Account</p>
          </div>
          <Link
            href={dest.href}
            className="text-sm text-brand-muted underline underline-offset-2 hover:text-brand"
          >
            {dest.label}
          </Link>
        </header>

        <section className={cardClasses}>
          <p className="text-sm text-brand-muted">Signed in as</p>
          <p className="mb-5 break-all font-medium">{email}</p>

          <h2 className="mb-3 font-semibold">Your name</h2>
          <form onSubmit={saveName} className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="display-name">
              Shown to staff at the counter
            </label>
            <input
              id="display-name"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClasses}
            />
            <button type="submit" disabled={busy} className={submitClasses}>
              {busy ? "Saving..." : "Save name"}
            </button>
          </form>
        </section>

        {/* Optional, and mainly for the counter device: signing in every
            shift with a code from an inbox is friction, so staff and the
            owner can set a password once and use it instead. Codes keep
            working either way. */}
        <section className={cardClasses}>
          <h2 className="mb-1 font-semibold">Password</h2>
          <p className="mb-4 text-sm text-brand-muted">
            Optional. Set one to sign in without waiting for an email code.
            Choose at least 8 characters, and do not reuse a password from
            anywhere else.
          </p>
          <form onSubmit={savePassword} className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClasses}
              required
            />
            <label className="text-sm font-medium" htmlFor="confirm-password">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClasses}
              required
            />
            <button type="submit" disabled={busy} className={submitClasses}>
              {busy ? "Saving..." : "Save password"}
            </button>
          </form>
        </section>

        {message && (
          <p className="animate-rise rounded-xl bg-brand-success/10 px-4 py-3 text-center text-sm text-brand-success">
            {message}
          </p>
        )}
        {error && (
          <p className="animate-rise rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="text-center">
          <SignOutButton />
        </div>

        <Footer />
      </div>
      <BottomNav role={role} />
    </>
  );
}
