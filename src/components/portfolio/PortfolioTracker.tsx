"use client";

import { useCallback, useEffect, useState } from "react";
import PortfolioRiskMetrics from "./PortfolioRiskMetrics";
import PortfolioAllocationChart from "./PortfolioAllocationChart";

type Holding = {
  id: string;
  ticker: string;
  shares: number;
  costBasis: number; // per share
};

type PriceMap = Record<string, number | null>;

const STORAGE_KEY = "ft-portfolio-holdings";

function loadHoldings(): Holding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Holding[]) : [];
  } catch {
    return [];
  }
}

function saveHoldings(holdings: Holding[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
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

function fmtPct(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function exportCsv(
  rows: Array<{
    ticker: string;
    shares: number;
    costBasis: number;
    currentPrice: number | null;
    currentValue: number | null;
    totalCost: number;
    pnl: number | null;
    pnlPct: number | null;
  }>,
): void {
  const header = [
    "Ticker",
    "Shares",
    "Avg Cost / Share",
    "Current Price",
    "Market Value",
    "Total Cost",
    "P&L",
    "% Gain",
  ];
  const csvRows = rows.map((r) =>
    [
      r.ticker,
      r.shares,
      r.costBasis.toFixed(2),
      r.currentPrice != null ? r.currentPrice.toFixed(2) : "",
      r.currentValue != null ? r.currentValue.toFixed(2) : "",
      r.totalCost.toFixed(2),
      r.pnl != null ? r.pnl.toFixed(2) : "",
      r.pnlPct != null ? r.pnlPct.toFixed(2) : "",
    ].join(","),
  );

  const csv = [header.join(","), ...csvRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `portfolio-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PortfolioTracker() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [prices, setPrices] = useState<PriceMap>({});
  const [loadingPrices, setLoadingPrices] = useState(false);

  // Form state
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [costBasis, setCostBasis] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setHoldings(loadHoldings());
  }, []);

  // Fetch live prices whenever holdings change
  const fetchPrices = useCallback(async (hs: Holding[]) => {
    if (hs.length === 0) {
      setPrices({});
      return;
    }
    setLoadingPrices(true);
    const symbols = [...new Set(hs.map((h) => h.ticker))];
    try {
      const res = await fetch(`/api/sparkline?symbols=${encodeURIComponent(symbols.join(","))}`);
      const data = (await res.json()) as Record<string, number[]>;
      const map: PriceMap = {};
      for (const sym of symbols) {
        const arr = data[sym] ?? [];
        map[sym] = arr.length > 0 ? arr[arr.length - 1]! : null;
      }
      setPrices(map);
    } catch {
      /* silently ignore — will show — for prices */
    } finally {
      setLoadingPrices(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrices(holdings);
  }, [holdings, fetchPrices]);

  function addHolding(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const sym = ticker.trim().toUpperCase();
    if (!/^[A-Z0-9.\-=^]+$/.test(sym)) {
      setFormError("Invalid ticker symbol");
      return;
    }
    const sharesNum = parseFloat(shares);
    const costNum = parseFloat(costBasis);
    if (!Number.isFinite(sharesNum) || sharesNum <= 0) {
      setFormError("Shares must be a positive number");
      return;
    }
    if (!Number.isFinite(costNum) || costNum <= 0) {
      setFormError("Cost basis must be a positive number");
      return;
    }

    const newHolding: Holding = {
      id: `${sym}-${Date.now()}`,
      ticker: sym,
      shares: sharesNum,
      costBasis: costNum,
    };

    const updated = [...holdings, newHolding];
    setHoldings(updated);
    saveHoldings(updated);
    setTicker("");
    setShares("");
    setCostBasis("");
  }

  function removeHolding(id: string) {
    const updated = holdings.filter((h) => h.id !== id);
    setHoldings(updated);
    saveHoldings(updated);
  }

  // Compute totals
  const rows = holdings.map((h) => {
    const currentPrice = prices[h.ticker] ?? null;
    const currentValue = currentPrice != null ? currentPrice * h.shares : null;
    const totalCost = h.costBasis * h.shares;
    const pnl = currentValue != null ? currentValue - totalCost : null;
    const pnlPct = pnl != null ? (pnl / totalCost) * 100 : null;
    return { ...h, currentPrice, currentValue, totalCost, pnl, pnlPct };
  });

  const totalCost = rows.reduce((acc, r) => acc + r.totalCost, 0);
  const totalValue = rows.every((r) => r.currentValue != null)
    ? rows.reduce((acc, r) => acc + (r.currentValue ?? 0), 0)
    : null;
  const totalPnl = totalValue != null ? totalValue - totalCost : null;
  const totalPnlPct = totalPnl != null && totalCost > 0 ? (totalPnl / totalCost) * 100 : null;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-mono text-lg font-bold tracking-tight">Portfolio Tracker</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Enter your holdings manually. Data stored locally in your browser. Prices sourced from Yahoo Finance (~15 min delayed).
        </p>
      </div>

      {/* Add holding form */}
      <section className="rounded-lg border border-black/10 bg-white px-4 py-4 dark:border-white/10 dark:bg-zinc-950">
        <h2 className="mb-3 font-mono text-sm font-semibold">Add Holding</h2>
        <form onSubmit={addHolding} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="AAPL"
              className="w-24 rounded border border-black/20 bg-zinc-50 px-2 py-1.5 font-mono text-sm uppercase dark:border-white/20 dark:bg-zinc-800"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Shares</label>
            <input
              type="number"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="100"
              min="0.0001"
              step="any"
              className="w-28 rounded border border-black/20 bg-zinc-50 px-2 py-1.5 font-mono text-sm dark:border-white/20 dark:bg-zinc-800"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Avg Cost / share ($)</label>
            <input
              type="number"
              value={costBasis}
              onChange={(e) => setCostBasis(e.target.value)}
              placeholder="150.00"
              min="0.0001"
              step="any"
              className="w-32 rounded border border-black/20 bg-zinc-50 px-2 py-1.5 font-mono text-sm dark:border-white/20 dark:bg-zinc-800"
              required
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Add
          </button>
        </form>
        {formError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{formError}</p>
        )}
      </section>

      {/* Holdings table */}
      {holdings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/20 px-6 py-10 text-center text-sm text-zinc-500 dark:border-white/20">
          No holdings yet. Add your first position above.
        </div>
      ) : (
        <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
          <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
            <h2 className="font-mono text-sm font-semibold">Holdings</h2>
            <div className="flex items-center gap-3">
              {loadingPrices && (
                <span className="text-xs text-zinc-400">Refreshing prices…</span>
              )}
              <button
                onClick={() => exportCsv(rows)}
                className="inline-flex items-center gap-1 rounded border border-black/15 bg-zinc-50 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                title="Export holdings to CSV"
              >
                ↓ CSV
              </button>
            </div>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs text-zinc-500 dark:border-white/10">
                  <th className="px-4 py-2 text-left font-medium">Ticker</th>
                  <th className="px-4 py-2 text-right font-medium">Shares</th>
                  <th className="px-4 py-2 text-right font-medium">Avg Cost</th>
                  <th className="px-4 py-2 text-right font-medium">Current</th>
                  <th className="px-4 py-2 text-right font-medium">Market Value</th>
                  <th className="px-4 py-2 text-right font-medium">P&amp;L</th>
                  <th className="px-4 py-2 text-right font-medium">% Gain</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/10">
                {rows.map((row) => {
                  const pnlUp = (row.pnl ?? 0) >= 0;
                  return (
                    <tr key={row.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5 font-mono font-semibold">{row.ticker}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{row.shares}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{fmtCurrency(row.costBasis)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {row.currentPrice != null ? fmtCurrency(row.currentPrice) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {row.currentValue != null ? fmtCurrency(row.currentValue) : "—"}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono text-xs font-semibold ${
                          row.pnl == null
                            ? "text-zinc-400"
                            : pnlUp
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {row.pnl != null ? fmtCurrency(row.pnl) : "—"}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono text-xs font-semibold ${
                          row.pnlPct == null
                            ? "text-zinc-400"
                            : pnlUp
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {row.pnlPct != null ? fmtPct(row.pnlPct) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => removeHolding(row.id)}
                          className="text-xs text-zinc-400 hover:text-red-500"
                          title="Remove holding"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-black/20 bg-zinc-50/50 dark:border-white/20 dark:bg-zinc-900/30 font-semibold">
                    <td className="px-4 py-2.5 font-mono text-xs" colSpan={4}>
                      Total ({rows.length} position{rows.length !== 1 ? "s" : ""})
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      {totalValue != null ? fmtCurrency(totalValue) : "—"}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono text-xs ${
                        totalPnl == null
                          ? "text-zinc-400"
                          : totalPnl >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {totalPnl != null ? fmtCurrency(totalPnl) : "—"}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono text-xs ${
                        totalPnlPct == null
                          ? "text-zinc-400"
                          : totalPnlPct >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {totalPnlPct != null ? fmtPct(totalPnlPct) : "—"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      {/* Portfolio Allocation Chart — shown once there are holdings */}
      {holdings.length > 0 && (
        <PortfolioAllocationChart rows={rows} />
      )}

      {/* Portfolio Risk Metrics — only shown when there are holdings with prices */}
      {holdings.length > 0 && (
        <PortfolioRiskMetrics holdings={holdings} prices={prices} />
      )}

      <p className="text-[10px] text-zinc-400">
        Holdings stored in browser localStorage · Prices from Yahoo Finance (last close, ~15 min delayed during market hours) · Not investment advice
      </p>
    </div>
  );
}
