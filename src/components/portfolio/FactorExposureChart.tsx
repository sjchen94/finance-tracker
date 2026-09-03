"use client";

/**
 * Factor / Style Exposure Breakdown
 *
 * Regresses the portfolio's daily price series against four style/factor
 * ETFs — VTV (value), VUG (growth), MTUM (momentum), SIZE (small-cap) —
 * using the existing single-factor beta calculation (computeBeta) from
 * riskMetrics.ts, one factor at a time. This is a simple pairwise-beta
 * "tilt" read rather than a full multivariate regression (which would need
 * a linear-algebra package we don't have) — but it answers the same
 * practical question: does the portfolio move more like value, growth,
 * momentum, or small-caps?
 *
 * Renders as a horizontal bar chart of factor betas.
 *
 * No new packages — pure SVG/Tailwind, reuses /api/history + riskMetrics.ts,
 * same fetch pattern as PortfolioBenchmarkChart.tsx.
 */

import { useEffect, useState } from "react";
import { computeBeta, computePortfolioPriceSeries } from "@/lib/portfolio/riskMetrics";

// ---- Types -----------------------------------------------------------------

type Holding = {
  ticker: string;
  shares: number;
  costBasis: number;
};

type PriceMap = Record<string, number | null>;
type CloseMap = Record<string, number[]>;

type FactorExposureChartProps = {
  holdings: Holding[];
  prices: PriceMap;
};

// ---- Constants ---------------------------------------------------------------

const FACTORS = [
  { symbol: "VTV", label: "Value", color: "#0ea5e9" },
  { symbol: "VUG", label: "Growth", color: "#8b5cf6" },
  { symbol: "MTUM", label: "Momentum", color: "#f59e0b" },
  { symbol: "SIZE", label: "Small-cap", color: "#10b981" },
] as const;

// ---- Helpers ---------------------------------------------------------------

async function fetchCloses(symbol: string, range = "6mo"): Promise<number[]> {
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

function fmtBeta(v: number | null): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
}

/** Dominant tilt = factor with the largest absolute beta. */
function dominantTilt(
  results: Array<{ label: string; beta: number | null }>,
): string | null {
  const withBeta = results.filter(
    (r): r is { label: string; beta: number } => r.beta != null,
  );
  if (withBeta.length === 0) return null;
  const top = withBeta.reduce((a, b) => (Math.abs(b.beta) > Math.abs(a.beta) ? b : a));
  return top.label;
}

// ---- Component -------------------------------------------------------------

export default function FactorExposureChart({ holdings, prices }: FactorExposureChartProps) {
  const [closeMap, setCloseMap] = useState<CloseMap>({});
  const [factorCloses, setFactorCloses] = useState<CloseMap>({});
  const [loading, setLoading] = useState(false);

  const activeTickers = [
    ...new Set(holdings.filter((h) => prices[h.ticker] != null).map((h) => h.ticker)),
  ];
  const fetchKey = activeTickers.slice().sort().join(",");

  useEffect(() => {
    if (activeTickers.length === 0) return;
    setLoading(true);

    const factorSymbols = FACTORS.map((f) => f.symbol);
    const allSymbols = [...new Set([...activeTickers, ...factorSymbols])];

    Promise.all(allSymbols.map((sym) => fetchCloses(sym).then((c) => [sym, c] as const)))
      .then((entries) => {
        const holdingsNext: CloseMap = {};
        const factorsNext: CloseMap = {};
        for (const [sym, c] of entries) {
          if ((factorSymbols as readonly string[]).includes(sym)) factorsNext[sym] = c;
          else holdingsNext[sym] = c;
        }
        setCloseMap(holdingsNext);
        setFactorCloses(factorsNext);
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  if (holdings.length === 0) return null;

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

  const portSeries = holdingsInput.length > 0 ? computePortfolioPriceSeries(holdingsInput) : null;

  const results = FACTORS.map((f) => {
    const factorSeries = factorCloses[f.symbol] ?? [];
    const beta =
      portSeries && factorSeries.length > 1 ? computeBeta(portSeries, factorSeries) : null;
    return { ...f, beta };
  });

  const hasAnyBeta = results.some((r) => r.beta != null);
  const tilt = dominantTilt(results);

  // Bar chart layout: horizontal bars centered at 0, betas typically in [-2, 2]
  const maxAbs = Math.max(1, ...results.map((r) => Math.abs(r.beta ?? 0)));
  const SVG_W = 600;
  const rowH = 34;
  const SVG_H = results.length * rowH + 8;
  const midX = SVG_W / 2;
  const barMax = SVG_W / 2 - 8;

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="font-mono text-sm font-semibold">Factor / Style Exposure</h2>
        {tilt && (
          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            Tilts {tilt}
          </span>
        )}
      </header>

      <div className="p-4">
        {loading ? (
          <div className="flex h-[140px] items-center justify-center text-xs text-zinc-400">
            Loading factor history…
          </div>
        ) : !hasAnyBeta ? (
          <div className="flex h-[140px] items-center justify-center text-xs text-zinc-400">
            Not enough price history to estimate factor exposure.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            width="100%"
            height={SVG_H}
            aria-label="Portfolio factor exposure chart"
          >
            {/* Center zero-line */}
            <line
              x1={midX}
              y1={0}
              x2={midX}
              y2={SVG_H}
              stroke="currentColor"
              strokeOpacity={0.15}
              strokeWidth={1}
              className="text-zinc-500"
            />
            {results.map((r, i) => {
              const y = i * rowH;
              const beta = r.beta ?? 0;
              const barW = (Math.abs(beta) / maxAbs) * barMax;
              const barX = beta >= 0 ? midX : midX - barW;
              return (
                <g key={r.symbol}>
                  <text
                    x={8}
                    y={y + rowH / 2 - 4}
                    className="fill-zinc-500"
                    style={{ fontSize: 10, fontFamily: "monospace" }}
                  >
                    {r.label} ({r.symbol})
                  </text>
                  {r.beta != null ? (
                    <>
                      <rect
                        x={barX}
                        y={y + rowH / 2}
                        width={Math.max(barW, 1)}
                        height={10}
                        rx={2}
                        fill={r.color}
                        opacity={0.85}
                      />
                      <text
                        x={beta >= 0 ? midX + barW + 6 : midX - barW - 6}
                        y={y + rowH / 2 + 9}
                        textAnchor={beta >= 0 ? "start" : "end"}
                        className="fill-zinc-600 dark:fill-zinc-300"
                        style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 600 }}
                      >
                        {fmtBeta(r.beta)}
                      </text>
                    </>
                  ) : (
                    <text
                      x={midX + 6}
                      y={y + rowH / 2 + 9}
                      className="fill-zinc-400"
                      style={{ fontSize: 10, fontFamily: "monospace" }}
                    >
                      —
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        <p className="mt-2 text-[10px] text-zinc-400">
          Each bar is a single-factor beta of the portfolio&apos;s daily returns vs. the named
          style ETF over the trailing 6 months (independently estimated per factor, not a joint
          multivariate regression — factors are correlated with each other so betas can overlap).
          Beta near 0 means low sensitivity to that factor; further from 0 means stronger tilt.
        </p>
      </div>
    </section>
  );
}
