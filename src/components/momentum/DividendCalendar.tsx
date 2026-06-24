"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DividendTicker, DividendsResponse } from "@/app/api/dividends/route";

// Days until a date (negative = past)
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

function urgencyBadge(days: number): { label: string; cls: string } {
  if (days < 0) return { label: "Past", cls: "text-zinc-400 bg-zinc-100 dark:bg-zinc-800" };
  if (days === 0) return { label: "Today", cls: "text-emerald-50 bg-emerald-600 font-bold" };
  if (days <= 5) return { label: `${days}d`, cls: "text-amber-900 bg-amber-300 font-semibold" };
  if (days <= 14) return { label: `${days}d`, cls: "text-sky-900 bg-sky-200 dark:bg-sky-800 dark:text-sky-100" };
  return { label: `${days}d`, cls: "text-zinc-500 bg-zinc-100 dark:bg-zinc-800" };
}

type Tab = "calendar" | "yield";

export default function DividendCalendar() {
  const [data, setData] = useState<DividendsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("calendar");
  const [fetched, setFetched] = useState(false);

  function load() {
    if (loading) return;
    setLoading(true);
    setError(null);
    fetch("/api/dividends")
      .then((r) => r.json())
      .then((d: DividendsResponse & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setFetched(true);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load dividend data"),
      )
      .finally(() => setLoading(false));
  }

  // Auto-load on first mount
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tickers with upcoming (or very recent) ex-dividend dates, sorted by proximity
  const calendarRows =
    data?.tickers
      .filter((t) => t.exDividendDate != null)
      .map((t) => ({ ...t, days: daysUntil(t.exDividendDate!) }))
      .sort((a, b) => {
        // upcoming first, then by closeness
        const aUp = a.days >= -30;
        const bUp = b.days >= -30;
        if (aUp && !bUp) return -1;
        if (!aUp && bUp) return 1;
        return Math.abs(a.days) - Math.abs(b.days);
      })
      .slice(0, 20) ?? [];

  // Tickers with yield data, sorted high-to-low
  const yieldRows =
    data?.tickers
      .filter((t) => t.dividendYieldPct != null && t.dividendYieldPct > 0)
      .sort((a, b) => (b.dividendYieldPct ?? 0) - (a.dividendYieldPct ?? 0)) ?? [];

  const noPayers = data != null && yieldRows.length === 0;

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-sm">$</span>
          <h2 className="font-mono text-sm font-semibold tracking-tight">Dividend Calendar</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="inline-flex items-center rounded border border-black/10 dark:border-white/10 text-xs overflow-hidden">
            <button
              onClick={() => setTab("calendar")}
              className={`px-2.5 py-1 transition-colors ${
                tab === "calendar"
                  ? "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              Ex-Dates
            </button>
            <button
              onClick={() => setTab("yield")}
              className={`px-2.5 py-1 transition-colors ${
                tab === "yield"
                  ? "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              Yield Tracker
            </button>
          </div>
          {fetched && (
            <button
              onClick={load}
              disabled={loading}
              className="text-[10px] text-zinc-400 hover:text-zinc-600 disabled:opacity-40"
              title="Refresh"
            >
              ↻
            </button>
          )}
        </div>
      </header>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 px-4 py-6 text-xs text-zinc-500">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
          Fetching dividend data…
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="px-4 py-4">
          <p className="text-xs text-red-600 dark:text-red-400">
            {error}{" "}
            <button onClick={load} className="ml-1 underline hover:no-underline">
              Retry
            </button>
          </p>
        </div>
      )}

      {/* Calendar tab — upcoming ex-dividend dates */}
      {!loading && !error && data && tab === "calendar" && (
        <>
          {calendarRows.length === 0 ? (
            <p className="px-4 py-5 text-sm text-zinc-500">
              No upcoming ex-dividend dates found for tracked tickers.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-[10px] uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-2 text-left font-medium">Ticker</th>
                    <th className="px-4 py-2 text-left font-medium hidden sm:table-cell">Sector</th>
                    <th className="px-4 py-2 text-right font-medium">Ex-Date</th>
                    <th className="px-4 py-2 text-right font-medium">In</th>
                    <th className="px-4 py-2 text-right font-medium">Yield</th>
                    <th className="px-4 py-2 text-right font-medium hidden sm:table-cell">Ann. Div/sh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {calendarRows.map((t) => {
                    const badge = urgencyBadge(t.days);
                    return (
                      <tr key={t.symbol} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-2">
                          <Link
                            href={`/ticker/${encodeURIComponent(t.symbol)}`}
                            className="font-mono font-semibold hover:underline"
                          >
                            {t.symbol}
                          </Link>
                          {t.shortName && (
                            <span className="ml-2 hidden font-normal text-zinc-500 sm:inline">
                              {t.shortName}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-zinc-500 hidden sm:table-cell">{t.sector}</td>
                        <td className="px-4 py-2 text-right font-mono">
                          {fmtDate(t.exDividendDate!)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {t.dividendYieldPct != null
                            ? <span className="text-emerald-600 dark:text-emerald-400">{t.dividendYieldPct.toFixed(2)}%</span>
                            : <span className="text-zinc-400">—</span>}
                        </td>
                        <td className="px-4 py-2 text-right font-mono hidden sm:table-cell text-zinc-600 dark:text-zinc-400">
                          {t.trailingAnnualDividendRate != null
                            ? `$${t.trailingAnnualDividendRate.toFixed(2)}`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-4 py-2 text-[10px] text-zinc-400 border-t border-black/5 dark:border-white/5">
            Ex-dividend dates from Yahoo Finance · Showing tracked sector tickers only
          </p>
        </>
      )}

      {/* Yield Tracker tab */}
      {!loading && !error && data && tab === "yield" && (
        <>
          {noPayers ? (
            <p className="px-4 py-5 text-sm text-zinc-500">
              No dividend-paying tickers found in the current tracked universe.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-[10px] uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-2 text-left font-medium">Ticker</th>
                    <th className="px-4 py-2 text-left font-medium hidden sm:table-cell">Sector</th>
                    <th className="px-4 py-2 text-right font-medium">Yield (ttm)</th>
                    <th className="px-4 py-2 text-right font-medium">Ann. Div/sh</th>
                    <th className="px-4 py-2 text-right font-medium hidden sm:table-cell">Price</th>
                    <th className="px-4 py-2 text-right font-medium hidden sm:table-cell">Ex-Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {yieldRows.map((t) => (
                    <tr key={t.symbol} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-2">
                        <Link
                          href={`/ticker/${encodeURIComponent(t.symbol)}`}
                          className="font-mono font-semibold hover:underline"
                        >
                          {t.symbol}
                        </Link>
                        {t.shortName && (
                          <span className="ml-2 hidden text-zinc-500 sm:inline">{t.shortName}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-zinc-500 hidden sm:table-cell">{t.sector}</td>
                      <td className="px-4 py-2 text-right">
                        {/* Yield bar */}
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden sm:block w-16 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{
                                width: `${Math.min(100, ((t.dividendYieldPct ?? 0) / 6) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {t.dividendYieldPct!.toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-600 dark:text-zinc-400">
                        {t.trailingAnnualDividendRate != null
                          ? `$${t.trailingAnnualDividendRate.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-500 hidden sm:table-cell">
                        {t.price != null ? `$${t.price.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-500 hidden sm:table-cell">
                        {t.exDividendDate ? fmtDate(t.exDividendDate) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-4 py-2 text-[10px] text-zinc-400 border-t border-black/5 dark:border-white/5">
            Trailing 12-month yield · Yahoo Finance data · Not all tech tickers pay dividends
          </p>
        </>
      )}
    </section>
  );
}
