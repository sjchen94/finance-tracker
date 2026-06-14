"use client";

import { useEffect, useState } from "react";
import {
  computeRiskMetrics,
  type RiskMetrics,
} from "@/lib/portfolio/riskMetrics";

type Holding = {
  ticker: string;
  shares: number;
  costBasis: number;
};

type PriceMap = Record<string, number | null>;

type PortfolioRiskMetricsProps = {
  holdings: Holding[];
  prices: PriceMap;
};

type CloseMap = Record<string, number[]>;

async function fetchCloses(symbol: string): Promise<number[]> {
  try {
    const res = await fetch(
      `/api/history?symbol=${encodeURIComponent(symbol)}&range=3mo&interval=1d`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      candles?: Array<{ close: number }>;
    };
    return (data.candles ?? []).map((c) => c.close);
  } catch {
    return [];
  }
}

function StatCard({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string;
  value: string;
  sub?: string;
  colorClass?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-black/10 bg-zinc-50/60 px-4 py-3 dark:border-white/10 dark:bg-zinc-900/40">
      <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      <span className={`font-mono text-xl font-bold ${colorClass ?? "text-zinc-900 dark:text-zinc-100"}`}>
        {value}
      </span>
      {sub && <span className="text-[10px] text-zinc-400">{sub}</span>}
    </div>
  );
}

function fmtPct(v: number | null, digits = 1): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(digits)}%`;
}

function fmtFixed(v: number | null, digits = 2): string {
  if (v == null) return "—";
  return v.toFixed(digits);
}

export default function PortfolioRiskMetrics({
  holdings,
  prices,
}: PortfolioRiskMetricsProps) {
  const [closeMap, setCloseMap] = useState<CloseMap>({});
  const [spyCloses, setSpyCloses] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  // Unique tickers that have a live price (i.e. contribute to market value)
  const activeTickers = [
    ...new Set(holdings.filter((h) => prices[h.ticker] != null).map((h) => h.ticker)),
  ];

  const closeMapKey = activeTickers.sort().join(",");

  useEffect(() => {
    if (activeTickers.length === 0) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect

    const allSymbols = [...new Set([...activeTickers, "SPY"])];

    Promise.all(allSymbols.map((sym) => fetchCloses(sym).then((c) => [sym, c] as const)))
      .then((entries) => {
        const newMap: CloseMap = {};
        for (const [sym, closes] of entries) {
          if (sym === "SPY") {
            setSpyCloses(closes);
          } else {
            newMap[sym] = closes;
          }
        }
        setCloseMap(newMap);
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeMapKey]);

  if (holdings.length === 0) return null;

  // Build holdings with market value + closes for risk calc
  const holdingsWithData = holdings
    .map((h) => {
      const currentPrice = prices[h.ticker];
      if (currentPrice == null) return null;
      const marketValue = currentPrice * h.shares;
      const closes = closeMap[h.ticker] ?? [];
      return { ticker: h.ticker, marketValue, closes };
    })
    .filter((h): h is NonNullable<typeof h> => h !== null && h.closes.length > 1);

  const metrics: RiskMetrics =
    holdingsWithData.length > 0 && !loading
      ? computeRiskMetrics(holdingsWithData, spyCloses)
      : { annualisedVolatility: null, sharpeRatio: null, maxDrawdown: null, beta: null };

  const noData = Object.keys(closeMap).length === 0;

  // Colour helpers
  const sharpeColor =
    metrics.sharpeRatio == null
      ? undefined
      : metrics.sharpeRatio >= 1
      ? "text-emerald-600 dark:text-emerald-400"
      : metrics.sharpeRatio >= 0
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  const drawdownColor =
    metrics.maxDrawdown == null
      ? undefined
      : metrics.maxDrawdown > -0.1
      ? "text-emerald-600 dark:text-emerald-400"
      : metrics.maxDrawdown > -0.2
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="font-mono text-sm font-semibold">Risk Metrics</h2>
        <span className="text-xs text-zinc-400">
          {loading ? "Computing…" : noData ? "Loading price history…" : "3-month trailing · SPY benchmark"}
        </span>
      </header>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <StatCard
          label="Annualised Vol"
          value={loading || noData ? "…" : fmtPct(metrics.annualisedVolatility)}
          sub="Daily returns × √252"
        />
        <StatCard
          label="Sharpe Ratio"
          value={loading || noData ? "…" : fmtFixed(metrics.sharpeRatio)}
          sub="Rf = 5% p.a."
          colorClass={sharpeColor}
        />
        <StatCard
          label="Max Drawdown"
          value={loading || noData ? "…" : fmtPct(metrics.maxDrawdown)}
          sub="From period high"
          colorClass={drawdownColor}
        />
        <StatCard
          label="Beta vs SPY"
          value={loading || noData ? "…" : fmtFixed(metrics.beta)}
          sub="3-month trailing"
        />
      </div>
      <p className="px-4 pb-3 text-[10px] text-zinc-400">
        Computed from 3-month daily close history. Portfolio series is market-value-weighted across holdings with available price data.
      </p>
    </section>
  );
}
