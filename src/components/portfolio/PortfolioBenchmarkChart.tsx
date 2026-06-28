"use client";

/**
 * Portfolio Performance vs Benchmark Chart
 *
 * Renders a pure-SVG line chart comparing the portfolio equity curve
 * against SPY (benchmark), both indexed to 100 at the start of the period.
 *
 * Uses computePortfolioPriceSeries() from riskMetrics.ts for the portfolio
 * series and a separately-fetched SPY series for the benchmark.
 * No new packages — pure SVG / Tailwind.
 */

import { useEffect, useState } from "react";
import { computePortfolioPriceSeries } from "@/lib/portfolio/riskMetrics";

// ---- Types -----------------------------------------------------------------

type Holding = {
  ticker: string;
  shares: number;
  costBasis: number;
};

type PriceMap = Record<string, number | null>;
type CloseMap = Record<string, number[]>;

type PortfolioBenchmarkChartProps = {
  holdings: Holding[];
  prices: PriceMap;
};

// ---- Helpers ---------------------------------------------------------------

async function fetchCloses(symbol: string, range = "3mo"): Promise<number[]> {
  try {
    const res = await fetch(
      `/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=1d`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { candles?: Array<{ close: number }> };
    return (data.candles ?? []).map((c) => c.close);
  } catch {
    return [];
  }
}

/** Normalise a price series to 100 at its first value. */
function indexTo100(series: number[]): number[] {
  if (series.length === 0) return [];
  const base = series[0]!;
  return base > 0 ? series.map((v) => (v / base) * 100) : series;
}

/** Build SVG polyline points string from a data array and viewport dimensions. */
function buildPolyline(
  data: number[],
  svgW: number,
  svgH: number,
  minVal: number,
  maxVal: number,
  padTop: number,
  padBottom: number,
): string {
  if (data.length === 0) return "";
  const n = data.length;
  const range = maxVal - minVal || 1;
  return data
    .map((v, i) => {
      const x = (i / (n - 1)) * svgW;
      const y = padTop + (1 - (v - minVal) / range) * (svgH - padTop - padBottom);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function fmtReturn(series: number[]): string {
  if (series.length < 2) return "—";
  const last = series[series.length - 1]!;
  const change = last - 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

// ---- Component -------------------------------------------------------------

const RANGE_OPTIONS = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
] as const;

type Range = (typeof RANGE_OPTIONS)[number]["value"];

export default function PortfolioBenchmarkChart({
  holdings,
  prices,
}: PortfolioBenchmarkChartProps) {
  const [closeMap, setCloseMap] = useState<CloseMap>({});
  const [spyCloses, setSpyCloses] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<Range>("3mo");

  const activeTickers = [
    ...new Set(
      holdings.filter((h) => prices[h.ticker] != null).map((h) => h.ticker),
    ),
  ];

  const fetchKey = `${activeTickers.slice().sort().join(",")}-${range}`;

  useEffect(() => {
    if (activeTickers.length === 0) return;
    setLoading(true);

    const allSymbols = [...new Set([...activeTickers, "SPY"])];
    Promise.all(
      allSymbols.map((sym) =>
        fetchCloses(sym, range).then((c) => [sym, c] as const),
      ),
    )
      .then((entries) => {
        const next: CloseMap = {};
        let spy: number[] = [];
        for (const [sym, c] of entries) {
          if (sym === "SPY") spy = c;
          else next[sym] = c;
        }
        setCloseMap(next);
        setSpyCloses(spy);
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  if (holdings.length === 0) return null;

  // Build portfolio series
  const holdingsInput = holdings
    .map((h) => {
      const currentPrice = prices[h.ticker];
      if (currentPrice == null) return null;
      return {
        marketValue: currentPrice * h.shares,
        closes: closeMap[h.ticker] ?? [],
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.closes.length > 1);

  const portSeries = holdingsInput.length > 0
    ? computePortfolioPriceSeries(holdingsInput)
    : null;

  // Align benchmark to same length as portfolio
  const benchRaw = spyCloses.length > 1 ? spyCloses : null;
  const n = portSeries ? portSeries.length : benchRaw ? benchRaw.length : 0;
  const benchSeries = benchRaw
    ? indexTo100(benchRaw.slice(benchRaw.length - n))
    : null;

  const hasData = portSeries != null || benchSeries != null;

  // SVG layout constants
  const SVG_W = 600;
  const SVG_H = 220;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 24;
  const PAD_LEFT = 44;

  // Determine y-axis range
  const allValues = [
    ...(portSeries ?? []),
    ...(benchSeries ?? []),
  ];
  const minVal = allValues.length > 0 ? Math.min(...allValues) - 2 : 88;
  const maxVal = allValues.length > 0 ? Math.max(...allValues) + 2 : 112;

  // Grid lines (4 horizontal)
  const gridLines = 4;
  const gridVals = Array.from({ length: gridLines + 1 }, (_, i) => {
    const frac = i / gridLines;
    return minVal + frac * (maxVal - minVal);
  });

  // Polyline helpers
  const portPoints = portSeries
    ? buildPolyline(portSeries, SVG_W - PAD_LEFT, SVG_H, minVal, maxVal, PAD_TOP, PAD_BOTTOM)
    : "";
  const benchPoints = benchSeries
    ? buildPolyline(benchSeries, SVG_W - PAD_LEFT, SVG_H, minVal, maxVal, PAD_TOP, PAD_BOTTOM)
    : "";

  // Translate x to include left padding
  const translateX = PAD_LEFT;

  const portReturn = portSeries ? fmtReturn(portSeries) : "—";
  const benchReturn = benchSeries ? fmtReturn(benchSeries) : "—";
  const portUp = portSeries
    ? (portSeries[portSeries.length - 1] ?? 100) >= 100
    : true;
  const benchUp = benchSeries
    ? (benchSeries[benchSeries.length - 1] ?? 100) >= 100
    : true;

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="font-mono text-sm font-semibold">Performance vs Benchmark</h2>
        <div className="flex items-center gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`rounded px-2 py-0.5 text-xs font-mono transition-colors ${
                range === opt.value
                  ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {/* Legend + returns */}
      <div className="flex flex-wrap items-center gap-4 px-4 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 rounded-full bg-blue-500" />
          <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
            Portfolio
          </span>
          <span
            className={`text-xs font-mono font-semibold ml-1 ${
              portUp
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {loading ? "…" : portReturn}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 rounded-full bg-zinc-400 dark:bg-zinc-500" style={{ borderTop: "2px dashed" }} />
          <span className="text-xs font-mono font-semibold text-zinc-500">
            SPY
          </span>
          <span
            className={`text-xs font-mono font-semibold ml-1 ${
              benchUp
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {loading ? "…" : benchReturn}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pb-2">
        {!hasData && !loading ? (
          <div className="flex h-[220px] items-center justify-center text-xs text-zinc-400">
            No price data available
          </div>
        ) : loading ? (
          <div className="flex h-[220px] items-center justify-center text-xs text-zinc-400">
            Loading price history…
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            preserveAspectRatio="none"
            width="100%"
            height={SVG_H}
            aria-label="Portfolio vs SPY performance chart"
          >
            {/* Y-axis grid + labels */}
            {gridVals.map((v) => {
              const yFrac = 1 - (v - minVal) / (maxVal - minVal);
              const y = PAD_TOP + yFrac * (SVG_H - PAD_TOP - PAD_BOTTOM);
              return (
                <g key={`grid-${v}`}>
                  <line
                    x1={PAD_LEFT}
                    y1={y}
                    x2={SVG_W}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={0.07}
                    strokeWidth={1}
                    className="text-zinc-500"
                  />
                  <text
                    x={PAD_LEFT - 4}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-zinc-400"
                    style={{ fontSize: 9, fontFamily: "monospace" }}
                  >
                    {v.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Baseline at 100 */}
            {(() => {
              const baseY = PAD_TOP + (1 - (100 - minVal) / (maxVal - minVal)) * (SVG_H - PAD_TOP - PAD_BOTTOM);
              return (
                <line
                  x1={PAD_LEFT}
                  y1={baseY}
                  x2={SVG_W}
                  y2={baseY}
                  stroke="currentColor"
                  strokeOpacity={0.2}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  className="text-zinc-400"
                />
              );
            })()}

            <g transform={`translate(${translateX}, 0)`}>
              {/* Benchmark line (dashed grey) */}
              {benchPoints && (
                <polyline
                  points={benchPoints}
                  fill="none"
                  stroke="#a1a1aa"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  strokeLinejoin="round"
                />
              )}

              {/* Portfolio line (solid blue) */}
              {portPoints && (
                <polyline
                  points={portPoints}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              )}

              {/* End-point dots */}
              {portSeries && portSeries.length > 0 && (() => {
                const lastIdx = portSeries.length - 1;
                const lastV = portSeries[lastIdx]!;
                const x = ((lastIdx) / (portSeries.length - 1)) * (SVG_W - PAD_LEFT);
                const y = PAD_TOP + (1 - (lastV - minVal) / (maxVal - minVal)) * (SVG_H - PAD_TOP - PAD_BOTTOM);
                return <circle cx={x} cy={y} r={3} fill="#3b82f6" />;
              })()}

              {benchSeries && benchSeries.length > 0 && (() => {
                const lastIdx = benchSeries.length - 1;
                const lastV = benchSeries[lastIdx]!;
                const x = ((lastIdx) / (benchSeries.length - 1)) * (SVG_W - PAD_LEFT);
                const y = PAD_TOP + (1 - (lastV - minVal) / (maxVal - minVal)) * (SVG_H - PAD_TOP - PAD_BOTTOM);
                return <circle cx={x} cy={y} r={3} fill="#a1a1aa" />;
              })()}
            </g>
          </svg>
        )}
      </div>

      <p className="px-4 pb-3 text-[10px] text-zinc-400">
        Both series indexed to 100 at period start. Portfolio weighted by market value. SPY = benchmark.
      </p>
    </section>
  );
}
