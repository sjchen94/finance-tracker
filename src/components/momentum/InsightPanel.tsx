"use client";

import { useState } from "react";
import type { SectorBundle } from "./types";
import type { InsightRequest } from "@/app/api/insight/route";

function buildPayload(bundle: SectorBundle): InsightRequest {
  return {
    sectors: bundle.sectors.map((s) => ({
      name: s.name,
      averageScore: s.averageScore,
      topTickers: [...s.tickers]
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((t) => ({
          symbol: t.symbol,
          score: t.score,
          changePercent: t.changePercent,
          breakout: t.breakout,
          rsi: t.rsi,
          return1m: t.return1m,
        })),
    })),
    marketIndicators: bundle.marketIndicators,
  };
}

type Status = "idle" | "loading" | "done" | "error";

export default function InsightPanel({ bundle }: { bundle: SectorBundle }) {
  const [status, setStatus] = useState<Status>("idle");
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchInsight() {
    setStatus("loading");
    setInsight(null);
    setError(null);
    try {
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(bundle)),
      });
      const json = (await res.json()) as { insight?: string; error?: string };
      if (!res.ok || json.error) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setInsight(json.insight ?? "");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get insight");
      setStatus("error");
    }
  }

  return (
    <section className="rounded-lg border border-violet-500/20 bg-violet-50/50 px-4 py-3 dark:border-violet-400/15 dark:bg-violet-950/20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">✦</span>
          <h2 className="font-mono text-sm font-semibold tracking-tight text-violet-900 dark:text-violet-300">
            AI Market Insight
          </h2>
        </div>
        <button
          onClick={() => void fetchInsight()}
          disabled={status === "loading"}
          className="rounded-md border border-violet-400/30 bg-violet-100 px-3 py-1 text-xs font-medium text-violet-800 hover:bg-violet-200 disabled:opacity-50 dark:border-violet-400/20 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50 transition-colors"
        >
          {status === "loading" ? "Analyzing…" : "Get insight"}
        </button>
      </div>

      {status === "idle" && (
        <p className="mt-2 text-xs text-zinc-500">
          Click &ldquo;Get insight&rdquo; to get a 2–3 sentence AI summary of the current momentum picture.
        </p>
      )}

      {status === "loading" && (
        <div className="mt-3 flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
          Analyzing sector data…
        </div>
      )}

      {status === "done" && insight && (
        <p className="mt-3 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          {insight}
        </p>
      )}

      {status === "error" && error && (
        <div className="mt-2 rounded border border-red-400/30 bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button
            onClick={() => void fetchInsight()}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {status === "done" && (
        <div className="mt-2 text-[10px] text-zinc-400">
          Powered by Claude · Based on current session data
        </div>
      )}
    </section>
  );
}
