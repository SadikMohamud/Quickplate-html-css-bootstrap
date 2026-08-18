"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import SignOutButton from "@/components/SignOutButton";
import TillPanel from "@/components/TillPanel";
import { getBrowserClient } from "@/lib/supabase/client";
import type { CardStatus, LoyaltyRule, Profile } from "@/lib/types";

export default function OwnerView() {
  const [rule, setRule] = useState<LoyaltyRule | null>(null);
  const [customers, setCustomers] = useState<CardStatus[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [promoteQuery, setPromoteQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [serving, setServing] = useState(false);

  const load = useCallback(async () => {
    const supabase = getBrowserClient();
    const [ruleRes, customersRes, teamRes] = await Promise.all([
      supabase.from("loyalty_rules").select("*").eq("active", true).maybeSingle(),
      supabase
        .from("card_status")
        .select("*")
        .order("last_stamp_at", { ascending: false, nullsFirst: false })
        .limit(200),
      supabase
        .from("profiles")
        .select("*")
        .in("role", ["staff", "owner"])
        .order("created_at"),
    ]);
    if (ruleRes.data) setRule(ruleRes.data);
    setCustomers(customersRes.data ?? []);
    setTeam(teamRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // load is async, so its state updates land in later microtasks,
    // not synchronously within the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function setRole(profileId: string, role: "staff" | "customer") {
    setError(null);
    setMessage(null);
    const { error: err } = await getBrowserClient()
      .from("profiles")
      .update({ role })
      .eq("id", profileId);
    if (err) {
      setError(err.message);
    } else {
      setMessage(
        role === "staff" ? "Staff member added." : "Staff access removed."
      );
      load();
    }
  }

  async function promote(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const term = promoteQuery.trim();
    if (!term) return;
    const escaped = term.replace(/[%,]/g, "");
    const { data, error: err } = await getBrowserClient()
      .from("profiles")
      .select("*")
      .or(`email.ilike.%${escaped}%,display_name.ilike.%${escaped}%`)
      .eq("role", "customer")
      .limit(2);
    if (err) {
      setError(err.message);
      return;
    }
    if (!data || data.length === 0) {
      setError(
        "No matching customer. They need to sign in to the app once first."
      );
      return;
    }
    if (data.length > 1) {
      setError("More than one match. Use the full email address.");
      return;
    }
    setPromoteQuery("");
    await setRole(data[0].id, "staff");
  }

  const totalStamps = customers.reduce((n, c) => n + c.lifetime_stamps, 0);
  const totalRedeemed = customers.reduce((n, c) => n + c.rewards_redeemed, 0);

  const cardClasses = "rounded-3xl bg-brand-surface p-6 shadow-sm";

  return (
    <>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 pb-28 pt-8">
        <header className="flex items-center justify-between">
          <div>
            <Logo className="h-9 w-auto" priority />
            <p className="mt-1 text-xs text-brand-muted">Owner dashboard</p>
          </div>
          <SignOutButton />
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-brand-muted">
            Loading...
          </div>
        ) : (
          <>
            <section>
              {!serving ? (
                <button
                  type="button"
                  onClick={() => setServing(true)}
                  className="w-full rounded-2xl bg-brand py-4 font-medium text-brand-on-primary shadow-sm"
                >
                  Serve a customer
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">Serve a customer</h2>
                    <button
                      type="button"
                      onClick={() => setServing(false)}
                      className="text-sm text-brand-muted underline underline-offset-2 hover:text-brand"
                    >
                      Close
                    </button>
                  </div>
                  {/* Same scan and stamp flow as the staff till. Refreshes
                      the dashboard counts whenever a stamp or redeem lands. */}
                  <TillPanel onStampChange={load} />
                </div>
              )}
            </section>

            <section className="grid grid-cols-3 gap-3">
              {[
                { label: "Customers", value: customers.length },
                { label: "Stamps issued", value: totalStamps },
                { label: "Rewards given", value: totalRedeemed },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl bg-brand-surface p-4 text-center shadow-sm"
                >
                  <p className="text-2xl font-semibold">{stat.value}</p>
                  <p className="mt-1 text-xs text-brand-muted">{stat.label}</p>
                </div>
              ))}
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                href="/owner/loyalty"
                className={`${cardClasses} block transition-colors hover:bg-brand-accent/8`}
              >
                <h2 className="font-semibold">Stamp card</h2>
                <p className="mt-1 text-sm text-brand-muted">
                  {rule
                    ? `${rule.total_stamps} stamps, edit the rewards`
                    : "Set up the card"}
                </p>
              </Link>
              <Link
                href="/owner/menu"
                className={`${cardClasses} block transition-colors hover:bg-brand-accent/8`}
              >
                <h2 className="font-semibold">Menu</h2>
                <p className="mt-1 text-sm text-brand-muted">
                  Categories, dishes, prices and variants
                </p>
              </Link>
            </section>

            <section className={cardClasses}>
              <h2 className="mb-4 font-semibold">Team</h2>
              <ul className="mb-4 flex flex-col gap-2">
                {team.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center justify-between rounded-xl bg-brand-accent/10 px-4 py-2.5 text-sm"
                  >
                    <span>
                      {member.display_name || member.email}
                      <span className="ml-2 text-xs capitalize text-brand-muted">
                        {member.role}
                      </span>
                    </span>
                    {member.role === "staff" && (
                      <button
                        type="button"
                        onClick={() => setRole(member.id, "customer")}
                        className="text-xs text-red-700 underline underline-offset-2"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <form onSubmit={promote} className="flex gap-2">
                <input
                  value={promoteQuery}
                  onChange={(e) => setPromoteQuery(e.target.value)}
                  placeholder="Email of new staff"
                  className="min-w-0 flex-1 rounded-xl border border-brand-accent/40 px-4 py-2.5 text-sm outline-none focus:border-brand-accent"
                />
                <button
                  type="submit"
                  className="rounded-xl border border-brand px-4 py-2.5 text-sm font-medium"
                >
                  Add staff
                </button>
              </form>
            </section>

            <section className={cardClasses}>
              <h2 className="mb-4 font-semibold">
                Customers
                {customers.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-brand-muted">
                    {customers.length}
                  </span>
                )}
              </h2>
              {customers.length === 0 ? (
                <p className="text-sm text-brand-muted">
                  No customers yet. They appear here after their first sign in.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {customers.map((c) => {
                    const total = rule?.total_stamps ?? 0;
                    const complete = total > 0 && c.stamps_on_card >= total;
                    return (
                      <li
                        key={c.customer_id}
                        className="rounded-2xl bg-brand-accent/10 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate font-medium">
                            {c.display_name || c.phone || c.email}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                              complete
                                ? "bg-brand-success text-brand-on-primary"
                                : "bg-brand-surface text-brand-muted"
                            }`}
                          >
                            {c.stamps_on_card}
                            {total ? ` / ${total}` : ""}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-brand-muted">
                          {c.lifetime_stamps} lifetime stamps, {c.rewards_redeemed}{" "}
                          rewards given
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}

        {message && (
          <p className="rounded-xl bg-brand-success/10 px-4 py-3 text-center text-sm text-brand-success">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
      <BottomNav role="owner" />
    </>
  );
}
