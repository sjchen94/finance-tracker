"use client";

import type { MarketQuote } from "./types";
import { formatPct } from "./types";

function marketStatus(now: Date): { label: string; color: string } {
  // NYSE hours ~9:30am – 4:00pm ET, Mon–Fri
  // Convert local time → ET using Intl
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  const minutes = et.getHours() * 60 + et.getMinutes();
  if (day === 0 || day === 6) return { label: "Closed (Weekend)", color: "text-zinc-500" };
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) {
    return { label: "Open", color: "text-emerald-500" };
  }
  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) {
    return { label: "Pre-market", color: "text-amber-500" };
  }
  if (minutes >= 16 * 60 && minutes < 20 * 60) {
    return { label: "After-hours", color: "text-amber-500" };
  }
  return { label: "Closed", color: "text-zinc-500" };
}

function QuotePill({ q, label }: { q: MarketQuote; label: string }) {
  const change = q?.changePercent ?? null;
  const up = (change ?? 0) >= 0;
  return (
    <div className="flex items-baseline gap-2 rounded-md border border-black/10 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-zinc-900">
      <span className="font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">{label}</span>
      <span className="font-mono text-sm">
        {q?.price != null ? q.price.toFixed(2) : "—"}
      </span>
      <span
        className={`font-mono text-xs ${
          change == null
            ? "text-zinc-500"
            : up
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
        }`}
      >
        {formatPct(change)}
      </span>
    </div>
  );
}

export default function HeaderBar(props: {
  spy: MarketQuote;
  qqq: MarketQuote;
  vix: MarketQuote;
  generatedAt: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const status = marketStatus(new Date());
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-zinc-900/40">
      <div className="flex items-center gap-2">
        <h1 className="font-mono text-lg font-bold tracking-tight">Momentum Tech Tracker</h1>
        <span className={`text-xs font-medium ${status.color}`}>● {status.label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <QuotePill q={props.spy} label="SPY" />
        <QuotePill q={props.qqq} label="QQQ" />
        <QuotePill q={props.vix} label="VIX" />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500">
          {props.refreshing
            ? "Refreshing…"
            : `Updated ${new Date(props.generatedAt).toLocaleTimeString()}`}
        </span>
        <button
          onClick={props.onRefresh}
          disabled={props.refreshing}
          className="rounded-md border border-black/10 px-2 py-1 text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5"
        >
          Refresh
        </button>
      </div>
    </header>
  );
}
