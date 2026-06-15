"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { TickerData, SectorData } from "./types";
import { scoreTier } from "./types";

// Config: "goal" is the target average score for the top-10 leaders to sustain
const STREAK_SCORE_THRESHOLD = 65; // tickers above this are "on streak"
const GOAL_COUNT = 5; // goal = 5 tickers sustaining strong momentum

type StreakEntry = {
  symbol: string;
  score: number;
  breakout: boolean;
  sector: string;
};

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const done = value >= max;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>{label}</span>
        <span className="font-mono font-semibold">
          {value} / {max}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${done ? "bg-emerald-500" : "bg-amber-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function StreakWidget({ sectors }: { sectors: SectorData[] }) {
  const streakers = useMemo<StreakEntry[]>(() => {
    const all: TickerData[] = sectors.flatMap((s) => s.tickers);
    return all
      .filter((t) => t.score >= STREAK_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((t) => ({
        symbol: t.symbol,
        score: t.score,
        breakout: t.breakout,
        sector: t.sector.name,
      }));
  }, [sectors]);

  const streakCount = streakers.length;
  const goalReached = streakCount >= GOAL_COUNT;

  // Compute a simple "heat" label based on count
  function heatLabel(count: number): string {
    if (count >= 8) return "🔥🔥🔥 Scorching";
    if (count >= 5) return "🔥🔥 Hot";
    if (count >= 3) return "🔥 Warm";
    if (count >= 1) return "· Cool";
    return "· Quiet";
  }

  return (
    <section className="rounded-lg border border-amber-500/20 bg-amber-50/40 px-4 py-3 dark:border-amber-400/15 dark:bg-amber-950/20">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-sm font-semibold tracking-tight text-amber-900 dark:text-amber-300">
            Momentum Streak
          </h2>
          <span className="text-xs text-amber-700 dark:text-amber-400">
            {heatLabel(streakCount)}
          </span>
        </div>
        <span className="font-mono text-xs text-zinc-500">score ≥ {STREAK_SCORE_THRESHOLD}</span>
      </header>

      <ProgressBar
        value={streakCount}
        max={GOAL_COUNT}
        label={goalReached ? "Goal reached!" : `Goal: ${GOAL_COUNT} strong tickers`}
      />

      {streakers.length === 0 ? (
        <p className="mt-3 text-center text-xs text-zinc-500">
          No tickers currently above the streak threshold.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {streakers.map((entry) => {
            const tier = scoreTier(entry.score);
            return (
              <li key={entry.symbol}>
                <Link
                  href={`/ticker/${encodeURIComponent(entry.symbol)}`}
                  title={`${entry.symbol} · ${entry.sector} · score ${entry.score.toFixed(0)}${entry.breakout ? " · Breakout" : ""}`}
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs font-bold transition-opacity hover:opacity-80 ${tier.fg} ${tier.bg}`}
                >
                  {entry.symbol}
                  {entry.breakout && <span className="text-[10px]">⚡</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2 text-[10px] text-zinc-400">
        Tickers maintaining strong momentum this session · goal: {GOAL_COUNT} leaders
      </p>
    </section>
  );
}
