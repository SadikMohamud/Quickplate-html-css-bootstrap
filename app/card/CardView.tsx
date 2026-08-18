"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import QRCode from "react-qr-code";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import SignOutButton from "@/components/SignOutButton";
import StampCard from "@/components/StampCard";
import { getBrowserClient } from "@/lib/supabase/client";
import { theme } from "@/lib/theme";
import type { CardMilestone, CardStatus, LoyaltyRule, Role } from "@/lib/types";

interface CardViewProps {
  userId: string;
  role: Role;
}

export default function CardView({ userId, role }: CardViewProps) {
  const [rule, setRule] = useState<LoyaltyRule | null>(null);
  const [status, setStatus] = useState<CardStatus | null>(null);
  const [milestones, setMilestones] = useState<CardMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);

  const load = useCallback(async () => {
    const supabase = getBrowserClient();
    const [ruleRes, statusRes, milestoneRes] = await Promise.all([
      supabase.from("loyalty_rules").select("*").eq("active", true).maybeSingle(),
      supabase
        .from("card_status")
        .select("*")
        .eq("customer_id", userId)
        .maybeSingle(),
      supabase
        .from("card_milestones")
        .select("*")
        .eq("customer_id", userId)
        .order("stamps_required"),
    ]);
    if (ruleRes.data) setRule(ruleRes.data);
    if (statusRes.data) {
      setStatus(statusRes.data);
      setName(statusRes.data.display_name ?? "");
    }
    setMilestones(milestoneRes.data ?? []);
    setLoading(false);
  }, [userId]);

  // Refresh on load, when the app regains focus, and every 10 seconds, so
  // a fresh stamp appears while the customer is still at the till.
  useEffect(() => {
    // load is async, so its state updates land in later microtasks,
    // not synchronously within the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, 10000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getBrowserClient();
    await supabase
      .from("profiles")
      .update({ display_name: name.trim() || null })
      .eq("id", userId);
    setEditingName(false);
    load();
  }

  const total = rule?.total_stamps ?? 0;
  const earned = status?.stamps_on_card ?? 0;
  const ready = milestones.filter((m) => m.earned && !m.redeemed);
  const next = milestones.find((m) => !m.earned);
  const remaining = next ? next.stamps_required - earned : 0;

  return (
    <>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-28 pt-8">
        <header className="flex items-center justify-between">
          <div>
            <Logo className="h-9 w-auto" priority />
            <p className="mt-1 text-xs text-brand-muted">{theme.descriptor}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/account"
              className="text-sm text-brand-muted underline underline-offset-2 hover:text-brand"
            >
              Account
            </Link>
            <SignOutButton />
          </div>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-brand-muted">
            Loading your card...
          </div>
        ) : (
          <>
            <section className="animate-rise rounded-3xl border-2 border-brand bg-brand-surface p-6 shadow-lg">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.25em] text-brand">
                    {theme.shopName}
                  </p>
                  {editingName ? (
                    <form onSubmit={saveName} className="mt-1 flex gap-2">
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-32 rounded-lg border border-brand-accent/40 px-2 py-1 outline-none focus:border-brand-accent"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-brand px-3 py-1 text-sm font-medium text-brand-on-primary"
                      >
                        Save
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      className="mt-0.5 text-lg font-semibold"
                    >
                      {status?.display_name ? status.display_name : "Add your name"}
                    </button>
                  )}
                </div>
                <span className="rounded-full bg-brand px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-brand-on-primary">
                  {theme.tagline}
                </span>
              </div>

              <StampCard earned={earned} total={total} milestones={milestones} />

              <p className="mt-5 text-center text-sm text-brand-muted">
                {total === 0
                  ? "Your card is being set up. Check back soon."
                  : ready.length > 0
                    ? "Reward ready. Show this to the counter."
                    : next
                      ? `${remaining} more ${remaining === 1 ? "stamp" : "stamps"} until ${next.reward_label}`
                      : "Card complete."}
              </p>
            </section>

            {ready.length > 0 && (
              <section className="animate-pop-in overflow-hidden rounded-3xl shadow-sm">
                <div className="shimmer px-5 py-5 text-center text-brand-on-primary">
                  <p className="text-lg font-semibold">
                    {ready.length === 1 ? "Reward unlocked" : "Rewards unlocked"}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {ready.map((m) => m.reward_label).join(" and ")}. Show this
                    screen at the counter.
                  </p>
                </div>
              </section>
            )}

            {status && (
              <section className="animate-rise rounded-3xl bg-brand-surface p-6 text-center shadow-sm">
                <p className="mb-4 text-sm text-brand-muted">
                  {ready.length > 0
                    ? "Have this scanned to claim your reward"
                    : "Show this at the counter to collect your stamp"}
                </p>
                <div className="mx-auto w-fit rounded-2xl bg-white p-4 shadow-inner">
                  <QRCode value={status.card_code} size={176} />
                </div>
                <p className="mt-3 text-xs text-brand-muted">
                  Unique to you &middot; one main item earns one stamp
                </p>
              </section>
            )}

            {status && status.rewards_redeemed > 0 && (
              <p className="text-center text-xs text-brand-muted">
                {status.rewards_redeemed}{" "}
                {status.rewards_redeemed === 1 ? "reward" : "rewards"} enjoyed so
                far
              </p>
            )}
          </>
        )}
      </div>
      <BottomNav role={role} />
    </>
  );
}
