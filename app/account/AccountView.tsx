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

// Sign in is passwordless, so there is no password to change here. What
// is left is the name shown at the counter.
export default function AccountView({
  userId,
  email,
  displayName,
  role,
}: AccountViewProps) {
  const [name, setName] = useState(displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
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

  const inputClasses =
    "w-full rounded-xl border border-brand-accent/40 bg-brand-surface px-4 py-3 outline-none focus:border-brand-accent";
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

        <section className="animate-rise rounded-3xl bg-brand-surface p-6 shadow-sm">
          <p className="text-sm text-brand-muted">Signed in as</p>
          <p className="mb-5 break-all font-medium">{email}</p>

          <h2 className="mb-3 font-semibold">Your name</h2>
          <form onSubmit={submit} className="flex flex-col gap-3">
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
            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-xl bg-brand py-3 font-medium text-brand-on-primary disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save name"}
            </button>
          </form>

          {message && (
            <p className="animate-rise mt-4 rounded-xl bg-brand-success/10 px-4 py-3 text-center text-sm text-brand-success">
              {message}
            </p>
          )}
          {error && (
            <p className="animate-rise mt-4 rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
              {error}
            </p>
          )}
        </section>

        <div className="text-center">
          <SignOutButton />
        </div>

        <Footer />
      </div>
      <BottomNav role={role} />
    </>
  );
}
