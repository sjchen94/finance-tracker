"use client";

/**
 * Portfolio Price Alerts
 *
 * Lets the user set target-price alerts ("notify when AAPL crosses above/below
 * $X") for their holdings. Alerts are checked client-side against the live
 * prices already being polled by PortfolioTracker (via /api/sparkline) — no
 * new data fetch, no server-side notification infra. Triggered alerts surface
 * as a dismissible banner and get flagged inline in the alert list; they stay
 * "triggered" until removed so a refresh doesn't lose the fact that it fired.
 *
 * Stored in localStorage, matching the pattern used by holdings/goal.
 */

import { useEffect, useState } from "react";

type Holding = {
  ticker: string;
};

type PriceMap = Record<string, number | null>;

type Direction = "above" | "below";

type PriceAlert = {
  id: string;
  ticker: string;
  direction: Direction;
  targetPrice: number;
  triggered: boolean;
  createdAt: number;
};

type Props = {
  holdings: Holding[];
  prices: PriceMap;
};

const STORAGE_KEY = "ft-portfolio-alerts";

function loadAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PriceAlert[]) : [];
  } catch {
    return [];
  }
}

function saveAlerts(alerts: PriceAlert[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    /* ignore */
  }
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

export default function PriceAlerts({ holdings, prices }: Props) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [ticker, setTicker] = useState("");
  const [direction, setDirection] = useState<Direction>("above");
  const [targetPrice, setTargetPrice] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const uniqueTickers = [...new Set(holdings.map((h) => h.ticker))];

  useEffect(() => {
    setAlerts(loadAlerts());
  }, []);

  // Default the ticker dropdown to the first holding once loaded
  useEffect(() => {
    if (!ticker && uniqueTickers.length > 0) setTicker(uniqueTickers[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueTickers.join(",")]);

  // Evaluate alerts against live prices whenever prices update
  useEffect(() => {
    setAlerts((prev) => {
      let changed = false;
      const next = prev.map((a) => {
        if (a.triggered) return a;
        const price = prices[a.ticker];
        if (price == null) return a;
        const fires =
          a.direction === "above" ? price >= a.targetPrice : price <= a.targetPrice;
        if (fires) {
          changed = true;
          return { ...a, triggered: true };
        }
        return a;
      });
      if (changed) saveAlerts(next);
      return changed ? next : prev;
    });
  }, [prices]);

  if (holdings.length === 0) return null;

  function addAlert(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const sym = ticker.trim().toUpperCase();
    if (!sym) {
      setFormError("Choose a ticker");
      return;
    }
    const price = parseFloat(targetPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setFormError("Target price must be a positive number");
      return;
    }
    const newAlert: PriceAlert = {
      id: `${sym}-${Date.now()}`,
      ticker: sym,
      direction,
      targetPrice: price,
      triggered: false,
      createdAt: Date.now(),
    };
    const updated = [...alerts, newAlert];
    setAlerts(updated);
    saveAlerts(updated);
    setTargetPrice("");
  }

  function removeAlert(id: string) {
    const updated = alerts.filter((a) => a.id !== id);
    setAlerts(updated);
    saveAlerts(updated);
  }

  const triggeredAlerts = alerts.filter((a) => a.triggered);
  const activeAlerts = alerts.filter((a) => !a.triggered);

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header className="border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="font-mono text-sm font-semibold">Price Alerts</h2>
      </header>

      {/* Triggered banner */}
      {triggeredAlerts.length > 0 && (
        <div className="border-b border-amber-500/20 bg-amber-50/60 px-4 py-3 dark:border-amber-400/15 dark:bg-amber-950/20">
          <ul className="space-y-1.5">
            {triggeredAlerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-amber-800 dark:text-amber-300">
                  <span className="font-mono font-semibold">{a.ticker}</span> crossed{" "}
                  {a.direction} {fmtCurrency(a.targetPrice)}
                  {prices[a.ticker] != null && (
                    <span className="text-zinc-500"> (now {fmtCurrency(prices[a.ticker]!)})</span>
                  )}
                </span>
                <button
                  onClick={() => removeAlert(a.id)}
                  className="shrink-0 rounded border border-amber-400/40 px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
                >
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-4">
        <form onSubmit={addAlert} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Ticker</label>
            <select
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="w-28 rounded border border-black/20 bg-zinc-50 px-2 py-1.5 font-mono text-sm uppercase dark:border-white/20 dark:bg-zinc-800"
            >
              {uniqueTickers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as Direction)}
              className="w-32 rounded border border-black/20 bg-zinc-50 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-zinc-800"
            >
              <option value="above">Rises above</option>
              <option value="below">Falls below</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Target price ($)</label>
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="200.00"
              min="0.01"
              step="any"
              className="w-32 rounded border border-black/20 bg-zinc-50 px-2 py-1.5 font-mono text-sm dark:border-white/20 dark:bg-zinc-800"
              required
            />
          </div>
          <button
            type="submit"
            disabled={uniqueTickers.length === 0}
            className="rounded-md bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Add Alert
          </button>
        </form>
        {formError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{formError}</p>}

        {/* Active alerts list */}
        {activeAlerts.length > 0 ? (
          <ul className="mt-4 divide-y divide-black/10 dark:divide-white/10">
            {activeAlerts.map((a) => {
              const current = prices[a.ticker];
              return (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <span>
                    <span className="font-mono font-semibold">{a.ticker}</span>{" "}
                    <span className="text-zinc-500">
                      {a.direction === "above" ? "≥" : "≤"} {fmtCurrency(a.targetPrice)}
                    </span>
                    {current != null && (
                      <span className="ml-2 text-zinc-400">now {fmtCurrency(current)}</span>
                    )}
                  </span>
                  <button
                    onClick={() => removeAlert(a.id)}
                    className="text-zinc-400 hover:text-red-500"
                    title="Remove alert"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-zinc-400">
            No active alerts. Set a target price above to get notified when it&apos;s crossed.
          </p>
        )}

        <p className="mt-3 text-[10px] text-zinc-400">
          Checked against prices refreshed while this page is open. Stored locally in your
          browser — not a push notification.
        </p>
      </div>
    </section>
  );
}
