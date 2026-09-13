"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computePortfolioPriceSeries,
  computeBeta,
  computeMaxDrawdown,
  computeSharpe,
  computeVolatility,
  rollingVolatility,
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

// Rolling volatility windows in trading days.
// ~21 trading days ≈ 30 calendar days, 63 ≈ 90, 252 ≈ 365.
const ROLLING_WINDOWS = [
  { label: "30d", days: 21, stroke: "#3b82f6" },
  { label: "90d", days: 63, stroke: "#8b5cf6" },
  { label: "365d", days: 252, stroke: "#f59e0b" },
] as const;

async function fetchCloses(symbol: string, range: string): Promise<number[]> {
  try {
    const res = await fetch(
      `/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=1d`,
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

// Build an SVG polyline points string for a small-multiple mini chart.
function polylinePoints(
  data: number[],
  width: number,
  height: number,
  padTop: number,
  padBottom: number,
  minVal: number,
  maxVal: number,
): string {
  if (data.length < 2) return "";
  const n = data.length;
  const range = maxVal - minVal || 1;
  return data
    .map((v, i) => {
      const x = (i / (n - 1)) * width;
      const y = padTop + (1 - (v - minVal) / range) * (height - padTop - padBottom);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function RollingVolMultiple({
  label,
  series,
  stroke,
}: {
  label: string;
  series: number[];
  stroke: string;
}) {
  const W = 200;
  const H = 80;
  const PAD_TOP = 10;
  const PAD_BOTTOM = 14;

  const last = series.length > 0 ? series[series.length - 1]! : null;
  const avg = series.length > 0 ? series.reduce((s, v) => s + v, 0) / series.length : null;

  const minVal = series.length > 0 ? Math.min(...series) : 0;
  const maxVal = series.length > 0 ? Math.max(...series) : 1;
  // Pad the range a touch so the line doesn't kiss the edges
  const pad = (maxVal - minVal) * 0.08 || 0.01;
  const yMin = Math.max(0, minVal - pad);
  const yMax = maxVal + pad;

  const points = polylinePoints(series, W, H, PAD_TOP, PAD_BOTTOM, yMin, yMax);

  // Average reference line
  const avgY = avg != null
    ? PAD_TOP + (1 - (avg - yMin) / (yMax - yMin || 1)) * (H - PAD_TOP - PAD_BOTTOM)
    : null;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-black/10 bg-zinc-50/60 px-3 py-2 dark:border-white/10 dark:bg-zinc-900/40">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          Rolling vol · {label}
        </span>
        <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
          {fmtPct(last, 1)}
        </span>
      </div>
      {series.length < 2 ? (
        <div
          className="flex items-center justify-center text-[10px] text-zinc-400"
          style={{ height: H }}
        >
          Not enough history
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          width="100%"
          height={H}
          aria-label={`Rolling ${label} volatility`}
        >
          {/* Average reference line */}
          {avgY != null && (
            <line
              x1={0}
              y1={avgY}
              x2={W}
              y2={avgY}
              stroke="currentColor"
              strokeOpacity={0.2}
              strokeWidth={1}
              strokeDasharray="3 3"
              className="text-zinc-400"
            />
          )}
          <polyline
            points={points}
            fill="none"
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </svg>
      )}
      <div className="flex items-center justify-between text-[9px] text-zinc-400">
        <span>min {fmtPct(series.length > 0 ? minVal : null, 0)}</span>
        <span>avg {fmtPct(avg, 0)}</span>
        <span>max {fmtPct(series.length > 0 ? maxVal : null, 0)}</span>
      </div>
    </div>
  );
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
    setLoading(true);

    // 5y range gives enough runway for a rolling 252-day (≈365d) window
    // to produce a visible series of ~4 years of rolling values.
    const allSymbols = [...new Set([...activeTickers, "SPY"])];

    Promise.all(allSymbols.map((sym) => fetchCloses(sym, "5y").then((c) => [sym, c] as const)))
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

  // Portfolio price series (weighted, indexed to 100) — memoised so
  // downstream metric + rolling-window computations don't recompute on every
  // render.
  const portSeries = useMemo(() => {
    const holdingsWithData = holdings
      .map((h) => {
        const currentPrice = prices[h.ticker];
        if (currentPrice == null) return null;
        return {
          marketValue: currentPrice * h.shares,
          closes: closeMap[h.ticker] ?? [],
        };
      })
      .filter((h): h is NonNullable<typeof h> => h !== null && h.closes.length > 1);
    if (holdingsWithData.length === 0) return null;
    return computePortfolioPriceSeries(holdingsWithData);
  }, [holdings, prices, closeMap]);

  const metrics: RiskMetrics = useMemo(() => {
    if (!portSeries) {
      return { annualisedVolatility: null, sharpeRatio: null, maxDrawdown: null, beta: null };
    }
    return {
      annualisedVolatility: computeVolatility(portSeries),
      sharpeRatio: computeSharpe(portSeries),
      maxDrawdown: computeMaxDrawdown(portSeries),
      beta: computeBeta(portSeries, spyCloses),
    };
  }, [portSeries, spyCloses]);

  const rollingSeries = useMemo(() => {
    if (!portSeries) return ROLLING_WINDOWS.map((w) => ({ ...w, series: [] as number[] }));
    return ROLLING_WINDOWS.map((w) => ({
      ...w,
      series: rollingVolatility(portSeries, w.days),
    }));
  }, [portSeries]);

  if (holdings.length === 0) return null;

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
          {loading ? "Computing…" : noData ? "Loading price history…" : "5-year daily · SPY benchmark"}
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
          sub="Trailing daily"
        />
      </div>

      {/* Rolling volatility — small-multiples strip */}
      <div className="border-t border-black/10 px-4 py-4 dark:border-white/10">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Rolling volatility
          </h3>
          <span className="text-[10px] text-zinc-400">
            Trailing window · annualised
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {rollingSeries.map((r) => (
            <RollingVolMultiple
              key={r.label}
              label={r.label}
              series={r.series}
              stroke={r.stroke}
            />
          ))}
        </div>
      </div>

      <p className="px-4 pb-3 text-[10px] text-zinc-400">
        Computed from 5-year daily close history. Portfolio series is market-value-weighted across
        holdings with available price data. Rolling windows use 21/63/252 trading days.
      </p>
    </section>
  );
}
