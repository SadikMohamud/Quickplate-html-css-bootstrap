"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QrScanner from "@/components/QrScanner";
import StampCard from "@/components/StampCard";
import { getBrowserClient } from "@/lib/supabase/client";
import type {
  AddStampsResult,
  CardStatus,
  ClaimableMilestone,
  LoyaltyRule,
  RedeemResult,
} from "@/lib/types";

interface Result extends AddStampsResult {
  name: string;
  customerId: string;
  // Set once a reward has been handed over, so the panel can say so.
  redeemedLabel?: string;
  cardReset?: boolean;
}

interface TillPanelProps {
  // Called after a stamp or redeem lands, so a parent (the owner
  // dashboard) can refresh its counts.
  onStampChange?: () => void;
}

const MAX_QUANTITY = 20;

// Scan and stamp till. One main item earns one stamp, and staff set the
// quantity before scanning when a customer buys for several people. Each
// stamp is written as its own event row by the database.
export default function TillPanel({ onStampChange }: TillPanelProps) {
  const [rule, setRule] = useState<LoyaltyRule | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLookup, setShowLookup] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<CardStatus[]>([]);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRule = useCallback(async () => {
    const { data } = await getBrowserClient()
      .from("loyalty_rules")
      .select("*")
      .eq("active", true)
      .maybeSingle();
    if (data) setRule(data);
  }, []);

  useEffect(() => {
    // Async: state updates land in a later microtask, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRule();
  }, [loadRule]);

  const clearResume = () => {
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
  };
  useEffect(() => clearResume, []);

  const resumeScanning = useCallback(() => {
    clearResume();
    setResult(null);
    setError(null);
    setPaused(false);
    setQuantity(1);
  }, []);

  const stamp = useCallback(
    async (customerId: string, name: string, howMany: number) => {
      setBusy(true);
      setError(null);
      const { data, error: err } = await getBrowserClient().rpc("add_stamps", {
        p_customer_id: customerId,
        p_quantity: howMany,
        // Idempotency key: a retry of this exact action cannot stamp twice.
        p_request_id: crypto.randomUUID(),
      });
      setBusy(false);
      if (err) {
        setError(err.message);
        setPaused(false);
        return;
      }
      setResult({ ...(data as AddStampsResult), name, customerId });
      onStampChange?.();
      // No auto-resume: the result stays up so staff can hand over a
      // reward or move on by choice, rather than a lingering QR code
      // stamping again on its own.
    },
    [onStampChange]
  );

  const handleScan = useCallback(
    async (cardCode: string) => {
      setPaused(true);
      clearResume();
      setError(null);
      const { data } = await getBrowserClient()
        .from("card_status")
        .select("customer_id, display_name")
        .eq("card_code", cardCode)
        .maybeSingle();
      if (!data) {
        setError("Card not recognised. Try again, or look them up by phone.");
        setPaused(false);
        return;
      }
      await stamp(data.customer_id, data.display_name || "Customer", quantity);
    },
    [stamp, quantity]
  );

  const redeem = useCallback(
    async (milestone: ClaimableMilestone) => {
      if (!result) return;
      setBusy(true);
      setError(null);
      const { data, error: err } = await getBrowserClient().rpc(
        "redeem_milestone",
        {
          p_customer_id: result.customerId,
          p_milestone_id: milestone.id,
          p_request_id: crypto.randomUUID(),
        }
      );
      setBusy(false);
      if (err) {
        setError(err.message);
        return;
      }
      const outcome = data as RedeemResult;
      if (outcome.status !== "redeemed") {
        setError(
          outcome.status === "already_redeemed"
            ? `${outcome.reward_label} has already been given on this card.`
            : `Not enough stamps yet for ${outcome.reward_label}.`
        );
        return;
      }
      setResult({
        ...result,
        claimable: result.claimable.filter((m) => m.id !== milestone.id),
        redeemedLabel: outcome.reward_label,
        cardReset: outcome.card_reset,
      });
      onStampChange?.();
    },
    [result, onStampChange]
  );

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMatches([]);
    const term = query.trim();
    if (term.length < 3) {
      setError("Enter at least 3 characters of a phone number, email or name.");
      return;
    }
    const escaped = term.replace(/[%,]/g, "");
    const { data, error: err } = await getBrowserClient()
      .from("card_status")
      .select("*")
      .or(
        `phone.ilike.%${escaped}%,email.ilike.%${escaped}%,display_name.ilike.%${escaped}%`
      )
      .limit(8);
    if (err) {
      setError(err.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("No matching customers. They may need to sign in once first.");
      return;
    }
    setMatches(data);
  }

  async function pickMatch(m: CardStatus) {
    setMatches([]);
    setQuery("");
    setShowLookup(false);
    setPaused(true);
    await stamp(
      m.customer_id,
      m.display_name || m.phone || m.email || "Customer",
      quantity
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-3xl bg-brand-surface p-4 shadow-sm">
        {result ? (
          <ResultCard
            result={result}
            total={rule?.total_stamps ?? result.total_stamps}
            busy={busy}
            onRedeem={redeem}
            onDone={resumeScanning}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <p className="font-semibold">Scan to stamp</p>
              <span className="flex items-center gap-1.5 text-xs text-brand-muted">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-success opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-success" />
                </span>
                Camera live
              </span>
            </div>

            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              disabled={busy}
            />

            <QrScanner
              onScan={handleScan}
              onError={(msg) => setError(msg)}
              paused={paused}
            />
            <p className="px-1 text-center text-xs text-brand-muted">
              One main item earns one stamp. Set the number first, then scan
              the customer&rsquo;s QR code.
            </p>
          </div>
        )}
      </section>

      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            setShowLookup((s) => !s);
            setError(null);
            setMatches([]);
          }}
          className="text-sm text-brand-muted underline underline-offset-2 hover:text-brand"
        >
          {showLookup ? "Hide lookup" : "No QR? Look up by phone"}
        </button>
      </div>

      {showLookup && (
        <section className="animate-rise rounded-3xl bg-brand-surface p-4 shadow-sm">
          <form onSubmit={search} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Phone, email or name"
              className="min-w-0 flex-1 rounded-xl border border-brand-accent/40 px-4 py-2.5 outline-none focus:border-brand-accent"
            />
            <button
              type="submit"
              className="rounded-xl border border-brand px-4 py-2.5 font-medium"
            >
              Find
            </button>
          </form>
          {matches.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {matches.map((m) => (
                <li key={m.customer_id}>
                  <button
                    type="button"
                    onClick={() => pickMatch(m)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-brand-accent/10"
                  >
                    <span>{m.display_name || m.phone || m.email}</span>
                    <span className="text-xs text-brand-muted">
                      {m.stamps_on_card} stamps
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {error && (
        <p className="animate-rise rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

// How many main items the customer is buying. Staff set it once, then
// scan; the database still writes one row per stamp.
function QuantityStepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  const clamp = (n: number) => Math.min(Math.max(n, 1), MAX_QUANTITY);
  const buttonClasses =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand text-xl font-medium text-brand disabled:opacity-40";

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand-accent/8 px-3 py-2">
      <label htmlFor="stamp-quantity" className="text-sm font-medium">
        Stamps
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="One fewer stamp"
          onClick={() => onChange(clamp(value - 1))}
          disabled={disabled || value <= 1}
          className={buttonClasses}
        >
          &minus;
        </button>
        <input
          id="stamp-quantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_QUANTITY}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 1))}
          className="w-16 rounded-xl border border-brand-accent/40 py-2 text-center font-semibold outline-none focus:border-brand-accent"
        />
        <button
          type="button"
          aria-label="One more stamp"
          onClick={() => onChange(clamp(value + 1))}
          disabled={disabled || value >= MAX_QUANTITY}
          className={buttonClasses}
        >
          +
        </button>
      </div>
    </div>
  );
}

function ResultCard({
  result,
  total,
  busy,
  onRedeem,
  onDone,
}: {
  result: Result;
  total: number;
  busy: boolean;
  onRedeem: (milestone: ClaimableMilestone) => void;
  onDone: () => void;
}) {
  const { status, granted, requested, stamps_on_card, claimable, name } = result;

  const headline = result.redeemedLabel
    ? "Reward given"
    : status === "complete"
      ? "Card is full"
      : status === "duplicate"
        ? "Already counted"
        : granted === 1
          ? "Stamp added"
          : `${granted} stamps added`;

  return (
    <div className="animate-pop-in flex flex-col items-center gap-4 px-2 py-4 text-center">
      {result.redeemedLabel || claimable.length > 0 ? <Sparkle /> : <Tick />}

      <div>
        <p className="text-lg font-semibold">{headline}</p>
        <p className="text-sm text-brand-muted">
          {name} &middot; {stamps_on_card} of {total}
        </p>
        {status === "partial" && (
          <p className="mt-1 text-xs text-brand-muted">
            {requested} requested, {granted} added. The card only had room for{" "}
            {granted}.
          </p>
        )}
        {result.redeemedLabel && (
          <p className="mt-1 text-sm font-medium text-brand-success">
            {result.redeemedLabel}
            {result.cardReset ? ". A fresh card starts now." : ""}
          </p>
        )}
      </div>

      <div className="w-full">
        <StampCard
          earned={stamps_on_card}
          total={total}
          animateLast={status === "stamped" || status === "partial"}
        />
      </div>

      {claimable.length > 0 && (
        <div className="flex w-full flex-col gap-2">
          <p className="text-sm font-medium text-brand-success">
            {claimable.length === 1 ? "Reward ready" : "Rewards ready"}
          </p>
          {claimable.map((milestone) => (
            <button
              key={milestone.id}
              type="button"
              onClick={() => onRedeem(milestone)}
              disabled={busy}
              className="rounded-xl bg-brand-success py-3 font-medium text-brand-on-primary disabled:opacity-50"
            >
              Give {milestone.reward_label}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onDone}
        className="w-full rounded-xl border border-brand py-3 font-medium"
      >
        Next customer
      </button>
    </div>
  );
}

function Tick() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 12.5l5.5 5.5L20 7" />
      </svg>
    </div>
  );
}

function Sparkle() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-success/15 text-brand-success">
      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9z" />
        <circle cx="18.5" cy="17.5" r="1.6" />
        <circle cx="5.5" cy="16.5" r="1.2" />
      </svg>
    </div>
  );
}
