"use client";

/**
 * Portfolio Dividend Income Tracker
 *
 * Projects the user's annual/monthly dividend income from their actual
 * holdings (shares owned x trailing annual dividend per share), and lists
 * upcoming ex-dividend dates for income-paying positions. Complements the
 * momentum dashboard's DividendCalendar (which only covers the fixed sector
 * universe) by working off whatever tickers the user has actually entered
 * in the Portfolio Tracker.
 */

import { useEffect, useState } from "react";
import type { PortfolioDividendsResponse } from "@/app/api/portfolio-dividends/route";

type Holding = {
  ticker: string;
  shares: number;
};

type Props = {
  holdings: Holding[];
  totalValue: number | null;
};

function fmtCurrency(v: number, maxFrac = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(v);
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DividendIncomeTracker({ holdings, totalValue }: Props) {
  const [data, setData] = useState<PortfolioDividendsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symbols = [...new Set(holdings.map((h) => h.ticker))];
  const fetchKey = symbols.slice().sort().join(",");

  useEffect(() => {
    if (symbols.length === 0) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/portfolio-dividends?symbols=${encodeURIComponent(fetchKey)}`)
      .then((r) => r.json())
      .then((d: PortfolioDividendsResponse & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load dividend data"),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  if (holdings.length === 0) return null;

  const byTicker = new Map(data?.dividends.map((d) => [d.symbol, d]) ?? []);

  const rows = holdings
    .map((h) => {
      const div = byTicker.get(h.ticker);
      const perShare = div?.annualDividendPerShare ?? null;
      const annualIncome = perShare != null ? perShare * h.shares : null;
      return {
        ticker: h.ticker,
        shares: h.shares,
        yieldPct: div?.dividendYieldPct ?? null,
        perShare,
        annualIncome,
        exDividendDate: div?.exDividendDate ?? null,
      };
    })
    .filter((r) => r.annualIncome != null && r.annualIncome > 0)
    .sort((a, b) => (b.annualIncome ?? 0) - (a.annualIncome ?? 0));

  const totalAnnualIncome = rows.reduce((s, r) => s + (r.annualIncome ?? 0), 0);
  const monthlyIncome = totalAnnualIncome / 12;
  const portfolioYieldPct =
    totalValue != null && totalValue > 0 ? (totalAnnualIncome / totalValue) * 100 : null;

  const upcoming = rows
    .filter((r) => r.exDividendDate != null)
    .map((r) => ({ ...r, days: daysUntil(r.exDividendDate!) }))
    .filter((r) => r.days >= -3)
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-sm">$</span>
          <h2 className="font-mono text-sm font-semibold tracking-tight">Dividend Income</h2>
        </div>
        {loading && <span className="text-xs text-zinc-400">Loading…</span>}
      </header>

      {error && (
        <p className="px-4 py-4 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {!error && !loading && rows.length === 0 && (
        <p className="px-4 py-5 text-sm text-zinc-500">
          None of your current holdings appear to pay dividends (or data is unavailable yet).
        </p>
      )}

      {rows.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 gap-3 border-b border-black/10 p-4 dark:border-white/10 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Projected annual income</p>
              <p className="font-mono text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                {fmtCurrency(totalAnnualIncome, 2)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Monthly average</p>
              <p className="font-mono text-lg font-semibold">{fmtCurrency(monthlyIncome, 2)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Portfolio yield</p>
              <p className="font-mono text-lg font-semibold">
                {portfolioYieldPct != null ? `${portfolioYieldPct.toFixed(2)}%` : "—"}
              </p>
            </div>
          </div>

          {/* Per-holding breakdown */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black/10 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-white/10">
                  <th className="px-4 py-2 text-left font-medium">Ticker</th>
                  <th className="px-4 py-2 text-right font-medium">Shares</th>
                  <th className="px-4 py-2 text-right font-medium">Yield</th>
                  <th className="px-4 py-2 text-right font-medium">Div/sh</th>
                  <th className="px-4 py-2 text-right font-medium">Annual Income</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {rows.map((r) => (
                  <tr key={r.ticker} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-mono font-semibold">{r.ticker}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.shares}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {r.yieldPct != null ? `${r.yieldPct.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-zinc-600 dark:text-zinc-400">
                      {r.perShare != null ? `$${r.perShare.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">
                      {fmtCurrency(r.annualIncome ?? 0, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Upcoming ex-dividend dates among holdings */}
          {upcoming.length > 0 && (
            <div className="border-t border-black/10 px-4 py-3 dark:border-white/10">
              <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Upcoming ex-dividend dates
              </h3>
              <ul className="flex flex-wrap gap-2">
                {upcoming.map((r) => (
                  <li
                    key={r.ticker}
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-zinc-50 px-2.5 py-1 text-[11px] dark:border-white/10 dark:bg-zinc-900"
                  >
                    <span className="font-mono font-semibold">{r.ticker}</span>
                    <span className="text-zinc-500">{fmtDate(r.exDividendDate!)}</span>
                    <span
                      className={`font-semibold ${
                        r.days <= 5 ? "text-amber-600 dark:text-amber-400" : "text-zinc-400"
                      }`}
                    >
                      {r.days <= 0 ? "today" : `${r.days}d`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="px-4 py-2 text-[10px] text-zinc-400 border-t border-black/5 dark:border-white/5">
            Based on trailing 12-month dividend rate x shares held. Actual future payouts may
            differ. Not investment advice.
          </p>
        </>
      )}
    </section>
  );
}
