"use client";

import { useEffect, useState } from "react";
import type { TickerStats } from "@/app/api/stats/route";

// ---- Formatters -----------------------------------------------------------

function fmtLargeNumber(v: number | null): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(0)}`;
}

function fmtFixed(v: number | null, digits = 2, prefix = ""): string {
  if (v == null) return "—";
  return `${prefix}${v.toFixed(digits)}`;
}

function fmtPct(v: number | null, digits = 1): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(digits)}%`;
}

function fmtPctDirect(v: number | null, digits = 2): string {
  if (v == null) return "—";
  return `${v.toFixed(digits)}%`;
}

function fmtPrice(v: number | null): string {
  if (v == null) return "—";
  return `$${v.toFixed(2)}`;
}

function fmtVolume(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${v}`;
}

function recommendationLabel(key: string | null): string {
  if (!key) return "—";
  const map: Record<string, string> = {
    strongBuy: "Strong Buy",
    buy: "Buy",
    hold: "Hold",
    underperform: "Underperform",
    sell: "Sell",
  };
  return map[key] ?? key;
}

function recommendationColor(key: string | null): string {
  if (!key) return "text-zinc-500";
  if (key === "strongBuy" || key === "buy") return "text-emerald-600 dark:text-emerald-400";
  if (key === "hold") return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

// ---- Stat tile ------------------------------------------------------------

function Stat({ label, value, sub, colorClass }: {
  label: string;
  value: string;
  sub?: string;
  colorClass?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      <span className={`font-mono text-sm font-semibold ${colorClass ?? "text-zinc-900 dark:text-zinc-100"}`}>
        {value}
      </span>
      {sub && <span className="text-[10px] text-zinc-400">{sub}</span>}
    </div>
  );
}

// ---- Section wrapper -------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {children}
      </div>
    </div>
  );
}

// ---- 52-week range bar ----------------------------------------------------

function RangeBar({
  low,
  high,
  current,
}: {
  low: number | null;
  high: number | null;
  current: number | null;
}) {
  if (low == null || high == null || current == null || high === low) return null;
  const pct = Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
  return (
    <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6">
      <div className="flex items-center gap-3 text-[10px] text-zinc-500">
        <span className="font-mono w-16 shrink-0">{fmtPrice(low)}</span>
        <div className="relative flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="absolute top-0 h-full rounded-full bg-zinc-400"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-1.5 rounded-sm bg-zinc-700 dark:bg-zinc-300"
            style={{ left: `${pct}%` }}
          />
        </div>
        <span className="font-mono w-16 shrink-0 text-right">{fmtPrice(high)}</span>
      </div>
      <p className="mt-0.5 text-center text-[10px] text-zinc-400">
        52-week range · current {fmtPrice(current)} ({pct.toFixed(0)}% of range)
      </p>
    </div>
  );
}

// ---- Main component -------------------------------------------------------

type Props = {
  symbol: string;
  currentPrice: number | null;
};

export default function TickerStats({ symbol, currentPrice }: Props) {
  const [stats, setStats] = useState<TickerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(`/api/stats?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((data: TickerStats & { error?: string }) => {
        if (data.error) throw new Error(data.error);
        setStats(data);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load stats"));
  }, [symbol]);

  if (error) {
    return (
      <div className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950 px-4 py-3">
        <p className="text-xs text-zinc-400">Stats unavailable: {error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
          Loading key stats…
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header
        className="flex cursor-pointer items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10 select-none"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <h2 className="font-mono text-sm font-semibold">Key Stats</h2>
          {stats.sector && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {stats.sector}
            </span>
          )}
          {stats.industry && (
            <span className="hidden rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 sm:inline-block dark:bg-zinc-800 dark:text-zinc-400">
              {stats.industry}
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-400">{expanded ? "▲ Collapse" : "▼ Expand"}</span>
      </header>

      {/* Always-visible quick stats row */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 border-b border-black/10 dark:border-white/10">
        <Stat label="Market Cap" value={fmtLargeNumber(stats.marketCap)} />
        <Stat label="Trailing P/E" value={fmtFixed(stats.trailingPE)} />
        <Stat label="EPS (ttm)" value={fmtFixed(stats.trailingEps, 2, "$")} />
        <Stat label="Div. Yield" value={stats.dividendYield != null ? fmtPctDirect(stats.dividendYield * 100) : "—"} />
        <Stat label="Avg Volume" value={fmtVolume(stats.averageVolume)} sub="30-day" />
        <Stat
          label="Analyst Rec."
          value={recommendationLabel(stats.recommendationKey)}
          colorClass={recommendationColor(stats.recommendationKey)}
          sub={stats.numberOfAnalystOpinions != null ? `${stats.numberOfAnalystOpinions} analysts` : undefined}
        />
      </div>

      {/* 52-week range bar — always visible */}
      <div className="px-4 py-3 border-b border-black/10 dark:border-white/10">
        <RangeBar
          low={stats.fiftyTwoWeekLow}
          high={stats.fiftyTwoWeekHigh}
          current={currentPrice}
        />
      </div>

      {/* Expanded detail sections */}
      {expanded && (
        <div className="px-4 py-4 space-y-5">
          <Section title="Valuation">
            <Stat label="Trailing P/E" value={fmtFixed(stats.trailingPE)} />
            <Stat label="Forward P/E" value={fmtFixed(stats.forwardPE)} />
            <Stat label="P/S (ttm)" value={fmtFixed(stats.priceToSalesTrailing12Months)} />
            <Stat label="P/B" value={fmtFixed(stats.priceToBook)} />
            <Stat label="EV" value={fmtLargeNumber(stats.enterpriseValue)} />
            <Stat label="Shares Out." value={stats.sharesOutstanding != null ? fmtVolume(stats.sharesOutstanding) : "—"} />
          </Section>

          <Section title="Earnings & Growth">
            <Stat label="EPS (ttm)" value={fmtFixed(stats.trailingEps, 2, "$")} />
            <Stat label="EPS (fwd)" value={fmtFixed(stats.forwardEps, 2, "$")} />
            <Stat label="Revenue Growth" value={fmtPct(stats.revenueGrowth)} colorClass={stats.revenueGrowth != null ? (stats.revenueGrowth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : undefined} />
            <Stat label="Earnings Growth" value={fmtPct(stats.earningsGrowth)} colorClass={stats.earningsGrowth != null ? (stats.earningsGrowth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : undefined} />
            <Stat label="Profit Margin" value={fmtPct(stats.profitMargins)} />
            <Stat label="ROE" value={fmtPct(stats.returnOnEquity)} />
          </Section>

          <Section title="Financial Health">
            <Stat label="Total Cash" value={fmtLargeNumber(stats.totalCash)} />
            <Stat label="Total Debt" value={fmtLargeNumber(stats.totalDebt)} />
            <Stat label="D/E Ratio" value={fmtFixed(stats.debtToEquity)} />
            <Stat label="Current Ratio" value={fmtFixed(stats.currentRatio)} />
            <Stat label="Free CF" value={fmtLargeNumber(stats.freeCashflow)} />
            <Stat label="ROA" value={fmtPct(stats.returnOnAssets)} />
          </Section>

          <Section title="Price Levels & Volume">
            <Stat label="52W High" value={fmtPrice(stats.fiftyTwoWeekHigh)} />
            <Stat label="52W Low" value={fmtPrice(stats.fiftyTwoWeekLow)} />
            <Stat label="50D MA" value={fmtPrice(stats.fiftyDayAverage)} />
            <Stat label="200D MA" value={fmtPrice(stats.twoHundredDayAverage)} />
            <Stat label="Avg Vol (30d)" value={fmtVolume(stats.averageVolume)} />
            <Stat label="Avg Vol (10d)" value={fmtVolume(stats.averageVolume10Day)} />
          </Section>

          <Section title="Analyst Consensus">
            <Stat label="Target Price" value={fmtPrice(stats.targetMeanPrice)} sub={currentPrice != null && stats.targetMeanPrice != null ? `${((stats.targetMeanPrice / currentPrice - 1) * 100).toFixed(1)}% upside` : undefined} />
            <Stat label="Recommendation" value={recommendationLabel(stats.recommendationKey)} colorClass={recommendationColor(stats.recommendationKey)} />
            <Stat label="Rating Score" value={fmtFixed(stats.recommendationMean)} sub="1=Strong Buy, 5=Sell" />
            <Stat label="# Analysts" value={stats.numberOfAnalystOpinions != null ? String(stats.numberOfAnalystOpinions) : "—"} />
            {stats.exDividendDate && (
              <Stat label="Ex-Div Date" value={stats.exDividendDate} />
            )}
            {stats.dividendYield != null && (
              <Stat label="Div. Yield" value={fmtPctDirect(stats.dividendYield * 100)} />
            )}
          </Section>

          {stats.longBusinessSummary && (
            <div>
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                About
              </h3>
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 line-clamp-4">
                {stats.longBusinessSummary}
              </p>
              {stats.website && (
                <a
                  href={stats.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {stats.website} ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
