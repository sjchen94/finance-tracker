"use client";

import { useState } from "react";
import Link from "next/link";
import type { SectorData, TickerData } from "./types";
import { formatPct, scoreTier } from "./types";

function TickerRow({ t }: { t: TickerData }) {
  const tier = scoreTier(t.score);
  const up = (t.changePercent ?? 0) >= 0;
  return (
    <Link
      href={`/ticker/${encodeURIComponent(t.symbol)}`}
      className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
    >
      <span className="w-14 font-mono font-semibold">{t.symbol}</span>
      <span
        className={`inline-flex w-10 justify-center rounded px-1 py-0.5 font-mono text-[10px] font-bold ${tier.fg} ${tier.bg}`}
      >
        {t.score.toFixed(0)}
      </span>
      <span
        className={`flex-1 text-right font-mono ${
          up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        }`}
      >
        {formatPct(t.changePercent)}
      </span>
      <span className="w-4 text-center" title={t.breakout ? "Breakout" : ""}>
        {t.breakout ? "⚡" : ""}
      </span>
    </Link>
  );
}

function ScoreMiniBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const tier = scoreTier(score);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={`h-full rounded-full ${tier.bg}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SectorCard({ sector }: { sector: SectorData }) {
  const [expanded, setExpanded] = useState(false);
  const tier = scoreTier(sector.averageScore);
  const sorted = [...sector.tickers].sort((a, b) => b.score - a.score);
  const breakoutCount = sorted.filter((t) => t.breakout).length;
  const topTicker = sorted[0];

  return (
    <section className="flex flex-col rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      {/* Summary header — always visible, clickable to expand */}
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded-lg"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-sm font-semibold truncate">{sector.name}</h3>
            {breakoutCount > 0 && (
              <span className="text-[10px] text-amber-500 font-mono">⚡{breakoutCount}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <ScoreMiniBar score={sector.averageScore} />
            <span className="font-mono text-[10px] text-zinc-500">
              avg {sector.averageScore.toFixed(0)}
            </span>
            {topTicker && (
              <span className="text-[10px] text-zinc-400 hidden sm:inline">
                · top: <span className="font-mono font-semibold">{topTicker.symbol}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex justify-center rounded px-1.5 py-0.5 font-mono text-xs font-bold ${tier.fg} ${tier.bg}`}
          >
            {sector.averageScore.toFixed(0)}
          </span>
          <span className="text-xs text-zinc-400 font-mono">
            {sorted.length}
          </span>
          <svg
            className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Detail — shown on expand */}
      {expanded && (
        <>
          <div className="border-t border-black/10 dark:border-white/10" />
          {sorted.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-zinc-500">
              No tickers match filters.
            </div>
          ) : (
            <ul className="divide-y divide-black/5 dark:divide-white/5">
              {sorted.map((t) => (
                <li key={t.symbol}>
                  <TickerRow t={t} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
