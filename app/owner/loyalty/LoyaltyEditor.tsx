"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import StampCard from "@/components/StampCard";
import { getBrowserClient } from "@/lib/supabase/client";
import type { CardMilestone, LoyaltyMilestone, LoyaltyRule } from "@/lib/types";

// The owner sets the card size and the rewards along it. The last
// milestone is the one that resets the card when it is claimed.
export default function LoyaltyEditor() {
  const [rule, setRule] = useState<LoyaltyRule | null>(null);
  const [milestones, setMilestones] = useState<LoyaltyMilestone[]>([]);
  const [totalStamps, setTotalStamps] = useState("10");
  const [newStamps, setNewStamps] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getBrowserClient();
    const { data: ruleRow } = await supabase
      .from("loyalty_rules")
      .select("*")
      .eq("active", true)
      .maybeSingle();

    if (ruleRow) {
      setRule(ruleRow);
      setTotalStamps(String(ruleRow.total_stamps));
      const { data: rows } = await supabase
        .from("loyalty_milestones")
        .select("*")
        .eq("rule_id", ruleRow.id)
        .order("stamps_required");
      setMilestones(rows ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // load is async, so its state updates land in later microtasks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function reset(text: string) {
    setMessage(text);
    setError(null);
    load();
  }

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    const total = Number(totalStamps);
    if (!Number.isInteger(total) || total < 1 || total > 50) {
      setError("Card size must be a whole number between 1 and 50.");
      return;
    }
    setBusy(true);
    const { error: err } = await getBrowserClient()
      .from("loyalty_rules")
      .insert({ name: "Stamp card", total_stamps: total });
    setBusy(false);
    if (err) setError(err.message);
    else reset("Card created.");
  }

  async function saveTotal(e: React.FormEvent) {
    e.preventDefault();
    if (!rule) return;
    const total = Number(totalStamps);
    if (!Number.isInteger(total) || total < 1 || total > 50) {
      setError("Card size must be a whole number between 1 and 50.");
      return;
    }
    setBusy(true);
    const { error: err } = await getBrowserClient()
      .from("loyalty_rules")
      .update({ total_stamps: total })
      .eq("id", rule.id);
    setBusy(false);
    if (err) setError(err.message);
    else reset("Card size saved.");
  }

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!rule) return;
    const stamps = Number(newStamps);
    if (!Number.isInteger(stamps) || stamps < 1) {
      setError("Enter the stamp count this reward lands on.");
      return;
    }
    if (!newLabel.trim()) {
      setError("Give the reward a name, such as Free wrap.");
      return;
    }
    setBusy(true);
    const { error: err } = await getBrowserClient()
      .from("loyalty_milestones")
      .insert({
        rule_id: rule.id,
        stamps_required: stamps,
        reward_label: newLabel.trim(),
        sort_order: milestones.length + 1,
      });
    setBusy(false);
    if (err) {
      setError(
        err.code === "23505"
          ? "There is already a reward at that stamp count."
          : err.message
      );
      return;
    }
    setNewStamps("");
    setNewLabel("");
    reset("Reward added.");
  }

  async function removeMilestone(id: string) {
    setBusy(true);
    const { error: err } = await getBrowserClient()
      .from("loyalty_milestones")
      .delete()
      .eq("id", id);
    setBusy(false);
    if (err) setError(err.message);
    else reset("Reward removed.");
  }

  const inputClasses =
    "w-full rounded-xl border border-brand-accent/40 px-4 py-2.5 text-sm outline-none focus:border-brand-accent";
  const cardClasses = "rounded-3xl bg-brand-surface p-6 shadow-sm";

  // The preview shows a full card, so the owner sees where each reward
  // lands on the letters before customers do.
  const preview: CardMilestone[] = milestones.map((m) => ({
    customer_id: "preview",
    milestone_id: m.id,
    stamps_required: m.stamps_required,
    reward_label: m.reward_label,
    sort_order: m.sort_order,
    earned: false,
    redeemed: false,
  }));

  return (
    <>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 pb-28 pt-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Stamp card</h1>
            <p className="text-xs text-brand-muted">
              Card size and the rewards along it
            </p>
          </div>
          <Link
            href="/owner"
            className="text-sm text-brand-muted underline underline-offset-2 hover:text-brand"
          >
            Dashboard
          </Link>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-brand-muted">
            Loading...
          </div>
        ) : !rule ? (
          <section className={cardClasses}>
            <h2 className="mb-2 font-semibold">No card yet</h2>
            <p className="mb-4 text-sm text-brand-muted">
              Choose how many stamps fill a card, then add the rewards.
            </p>
            <form onSubmit={createRule} className="flex flex-col gap-3">
              <label className="text-sm" htmlFor="total-stamps-new">
                Stamps on a full card
              </label>
              <input
                id="total-stamps-new"
                type="number"
                min={1}
                max={50}
                value={totalStamps}
                onChange={(e) => setTotalStamps(e.target.value)}
                className={inputClasses}
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-brand py-3 font-medium text-brand-on-primary disabled:opacity-50"
              >
                Create card
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className={cardClasses}>
              <h2 className="mb-4 font-semibold">Preview</h2>
              <StampCard
                earned={0}
                total={rule.total_stamps}
                milestones={preview}
              />
            </section>

            <section className={cardClasses}>
              <h2 className="mb-4 font-semibold">Card size</h2>
              <form onSubmit={saveTotal} className="flex flex-col gap-3">
                <label className="text-sm" htmlFor="total-stamps">
                  Stamps on a full card
                </label>
                <input
                  id="total-stamps"
                  type="number"
                  min={1}
                  max={50}
                  value={totalStamps}
                  onChange={(e) => setTotalStamps(e.target.value)}
                  className={inputClasses}
                />
                <p className="text-xs text-brand-muted">
                  The card face prints one letter per stamp. At ten stamps it
                  reads ZAAT over ZAATAR; at any other size it falls back to
                  numbers.
                </p>
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-1 rounded-xl bg-brand py-3 font-medium text-brand-on-primary disabled:opacity-50"
                >
                  Save card size
                </button>
              </form>
            </section>

            <section className={cardClasses}>
              <h2 className="mb-1 font-semibold">Rewards</h2>
              <p className="mb-4 text-sm text-brand-muted">
                Claiming the last reward on the card starts a fresh one.
              </p>

              <ul className="mb-5 flex flex-col gap-2">
                {milestones.length === 0 && (
                  <li className="text-sm text-brand-muted">
                    No rewards yet. Add the first one below.
                  </li>
                )}
                {milestones.map((m, i) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-brand-accent/10 px-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{m.reward_label}</span>
                      <span className="ml-2 text-xs text-brand-muted">
                        at {m.stamps_required} stamps
                        {i === milestones.length - 1 && " (resets the card)"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMilestone(m.id)}
                      disabled={busy}
                      className="shrink-0 text-xs text-red-700 underline underline-offset-2 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>

              <form onSubmit={addMilestone} className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={rule.total_stamps}
                    placeholder="Stamps"
                    aria-label="Stamps required"
                    value={newStamps}
                    onChange={(e) => setNewStamps(e.target.value)}
                    className="w-28 rounded-xl border border-brand-accent/40 px-4 py-2.5 text-sm outline-none focus:border-brand-accent"
                  />
                  <input
                    type="text"
                    placeholder="Free wrap"
                    aria-label="Reward"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-brand-accent/40 px-4 py-2.5 text-sm outline-none focus:border-brand-accent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl border border-brand py-3 font-medium disabled:opacity-50"
                >
                  Add reward
                </button>
              </form>
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
