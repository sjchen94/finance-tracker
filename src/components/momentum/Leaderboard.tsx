"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TickerData } from "./types";
import { formatPct, scoreTier } from "./types";
import Sparkline from "./Sparkline";

export default function Leaderboard({
  tickers,
  limit = 10,
  highlightedSymbols,
}: {
  tickers: TickerData[];
  limit?: number;
  highlightedSymbols?: Set<string>;
}) {
  const top = [...tickers].sort((a, b) => b.score - a.score).slice(0, limit);
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});

  useEffect(() => {
    if (top.length === 0) return;
    const symbols = top.map((t) => t.symbol).join(",");
    fetch(`/api/sparkline?symbols=${encodeURIComponent(symbols)}`)
      .then((r) => r.json())
      .then((data: Record<string, number[]>) => setSparklines(data))
      .catch(() => {/* silently fail — sparklines are decorative */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top.map((t) => t.symbol).join(",")]);

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header className="flex items-baseline justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="font-mono text-sm font-semibold tracking-tight">
          🏆 Leaderboard
        </h2>
        <span className="text-xs text-zinc-500">
          {highlightedSymbols && highlightedSymbols.size > 0
            ? `${highlightedSymbols.size} screener match${highlightedSymbols.size !== 1 ? "es" : ""} highlighted`
            : `Top ${top.length} by momentum score`}
        </span>
      </header>
      {top.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-zinc-500">
          No tickers match the current filters.
        </div>
      ) : (
        <ul className="divide-y divide-black/10 dark:divide-white/10">
          {top.map((t, i) => {
            const tier = scoreTier(t.score);
            const up = (t.changePercent ?? 0) >= 0;
            const closes = sparklines[t.symbol] ?? [];
            const isHighlighted = highlightedSymbols?.has(t.symbol) ?? false;
            return (
              <li key={t.symbol} className={isHighlighted ? "bg-amber-50/60 dark:bg-amber-900/20" : ""}>
                <Link
                  href={`/ticker/${encodeURIComponent(t.symbol)}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
                  <span className="w-6 text-right font-mono text-xs text-zinc-500">
                    {i + 1}
                  </span>
                  <span className="w-16 font-mono text-sm font-semibold">{t.symbol}</span>
                  <span className="hidden flex-1 truncate text-xs text-zinc-500 sm:block">
                    {t.sector.name}
                  </span>
                  {/* 7-day sparkline */}
                  <span className="hidden sm:block">
                    <Sparkline closes={closes} width={72} height={28} />
                  </span>
                  <span
                    className={`inline-flex w-14 justify-center rounded px-1.5 py-0.5 font-mono text-xs font-bold ${tier.fg} ${tier.bg}`}
                  >
                    {t.score.toFixed(0)}
                  </span>
                  <span
                    className={`w-20 text-right font-mono text-xs ${
                      up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatPct(t.changePercent)}
                  </span>
                  <span className="w-6 text-center text-xs" title={t.breakout ? "Breakout" : ""}>
                    {t.breakout ? "⚡" : ""}
                  </span>
                  {isHighlighted && (
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400" title="Screener match">
                      match
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
