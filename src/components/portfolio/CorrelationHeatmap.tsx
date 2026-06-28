"use client";

/**
 * Holding Correlation Heatmap
 *
 * Displays an N×N grid of Pearson correlation coefficients between each pair
 * of holdings, computed from 3-month daily log-returns.
 *
 * Colour coding:
 *   green  r < 0.3  — low correlation
 *   amber  0.3 ≤ r < 0.7  — moderate
 *   red    r ≥ 0.7  — high (concentration risk)
 *
 * Concentration warnings are shown for any pair with r ≥ 0.7.
 *
 * Gate: only rendered when holdings.length >= 2.
 * No new packages — pure SVG / Tailwind.
 */

import { useEffect, useState } from "react";
import { logReturns, pearsonCorrelation } from "@/lib/portfolio/riskMetrics";

// ---- Types -----------------------------------------------------------------

type Holding = {
  ticker: string;
  shares: number;
  costBasis: number;
};

type PriceMap = Record<string, number | null>;
type CloseMap = Record<string, number[]>;

type CorrelationHeatmapProps = {
  holdings: Holding[];
  prices: PriceMap;
};

// ---- Helpers ---------------------------------------------------------------

async function fetchCloses(symbol: string): Promise<number[]> {
  try {
    const res = await fetch(
      `/api/history?symbol=${encodeURIComponent(symbol)}&range=3mo&interval=1d`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { candles?: Array<{ close: number }> };
    return (data.candles ?? []).map((c) => c.close);
  } catch {
    return [];
  }
}

/** Map a correlation value to a Tailwind bg class + text-colour class. */
function corrColor(r: number): { bg: string; text: string } {
  const abs = Math.abs(r);
  if (abs >= 0.7) return { bg: "bg-red-500/80", text: "text-white" };
  if (abs >= 0.3) return { bg: "bg-amber-400/80", text: "text-zinc-900" };
  return { bg: "bg-emerald-500/70", text: "text-white" };
}

function fmtCorr(r: number | null): string {
  if (r == null) return "—";
  return r.toFixed(2);
}

// ---- Component -------------------------------------------------------------

export default function CorrelationHeatmap({ holdings, prices }: CorrelationHeatmapProps) {
  const [closeMap, setCloseMap] = useState<CloseMap>({});
  const [loading, setLoading] = useState(false);

  // Unique tickers that have a live price
  const tickers = [
    ...new Set(
      holdings
        .filter((h) => prices[h.ticker] != null)
        .map((h) => h.ticker),
    ),
  ];

  const closeMapKey = tickers.slice().sort().join(",");

  useEffect(() => {
    if (tickers.length < 2) return;
    setLoading(true);

    Promise.all(tickers.map((t) => fetchCloses(t).then((c) => [t, c] as const)))
      .then((entries) => {
        const next: CloseMap = {};
        for (const [t, c] of entries) next[t] = c;
        setCloseMap(next);
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeMapKey]);

  // Require at least 2 holdings
  if (holdings.length < 2) return null;

  // Build correlation matrix
  const returnMap: Record<string, number[]> = {};
  for (const t of tickers) {
    const closes = closeMap[t] ?? [];
    returnMap[t] = closes.length > 1 ? logReturns(closes) : [];
  }

  const matrix: (number | null)[][] = tickers.map((row) =>
    tickers.map((col) => {
      if (row === col) return 1;
      const a = returnMap[row] ?? [];
      const b = returnMap[col] ?? [];
      return pearsonCorrelation(a, b);
    }),
  );

  // Concentration warnings — pairs with |r| >= 0.7 (excluding diagonal)
  const warnings: Array<{ a: string; b: string; r: number }> = [];
  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      const r = matrix[i]?.[j] ?? null;
      if (r != null && Math.abs(r) >= 0.7) {
        warnings.push({ a: tickers[i]!, b: tickers[j]!, r });
      }
    }
  }

  const hasData = tickers.some((t) => (returnMap[t]?.length ?? 0) > 4);

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="font-mono text-sm font-semibold">Correlation Heatmap</h2>
        <span className="text-xs text-zinc-400">
          {loading
            ? "Computing…"
            : !hasData
            ? "Loading price history…"
            : "3-month trailing · Pearson r"}
        </span>
      </header>

      <div className="overflow-x-auto p-4">
        {/* Legend */}
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[10px] text-zinc-500">
          <span className="font-semibold uppercase tracking-wide">Correlation r:</span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500/70" />
            Low (&lt;0.3)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-amber-400/80" />
            Moderate (0.3–0.7)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-red-500/80" />
            High (&gt;0.7)
          </span>
        </div>

        {/* Matrix grid */}
        <div
          className="inline-grid gap-0.5"
          style={{
            gridTemplateColumns: `max-content repeat(${tickers.length}, 56px)`,
          }}
        >
          {/* Header row — column labels */}
          <div /> {/* top-left empty cell */}
          {tickers.map((t) => (
            <div
              key={`col-${t}`}
              className="h-8 flex items-center justify-center text-[10px] font-mono font-semibold text-zinc-500 truncate px-1"
              title={t}
            >
              {t.length > 5 ? `${t.slice(0, 5)}…` : t}
            </div>
          ))}

          {/* Data rows */}
          {tickers.map((rowT, ri) => (
            <>
              {/* Row label */}
              <div
                key={`row-label-${rowT}`}
                className="flex items-center justify-end pr-2 text-[10px] font-mono font-semibold text-zinc-500 truncate max-w-[64px]"
                title={rowT}
              >
                {rowT.length > 5 ? `${rowT.slice(0, 5)}…` : rowT}
              </div>

              {/* Cells */}
              {tickers.map((colT, ci) => {
                const r = matrix[ri]?.[ci] ?? null;
                const isDiag = ri === ci;
                const { bg, text } = isDiag
                  ? { bg: "bg-zinc-200 dark:bg-zinc-700", text: "text-zinc-600 dark:text-zinc-300" }
                  : r != null
                  ? corrColor(r)
                  : { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-400" };

                return (
                  <div
                    key={`cell-${rowT}-${colT}`}
                    className={`h-12 w-14 flex items-center justify-center rounded text-[11px] font-mono font-semibold ${bg} ${text} ${loading && !isDiag ? "opacity-40" : ""}`}
                    title={
                      r != null && !isDiag
                        ? `${rowT} vs ${colT}: r = ${r.toFixed(3)}`
                        : isDiag
                        ? rowT
                        : "Insufficient data"
                    }
                  >
                    {isDiag ? "1.00" : loading ? "…" : fmtCorr(r)}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>

      {/* Concentration warnings */}
      {warnings.length > 0 && (
        <div className="border-t border-black/10 px-4 py-3 dark:border-white/10">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
            Concentration warnings
          </p>
          <ul className="space-y-0.5">
            {warnings.map(({ a, b, r }) => (
              <li key={`warn-${a}-${b}`} className="text-xs text-zinc-700 dark:text-zinc-300">
                <span className="font-mono font-semibold">{a}</span> and{" "}
                <span className="font-mono font-semibold">{b}</span> are highly correlated
                {" "}
                <span className="font-mono text-red-600 dark:text-red-400">
                  (r = {r.toFixed(2)})
                </span>
                {" "}— overlapping exposure may not add diversification.
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="px-4 pb-3 text-[10px] text-zinc-400">
        Computed from 3-month daily log-returns. Diagonal = self-correlation (always 1.00).
      </p>
    </section>
  );
}
