"use client";

import { useEffect, useState } from "react";
import type { InsightRequest, PortfolioHoldingContext } from "@/app/api/insight/route";

type HoldingRow = {
  ticker: string;
  shares: number;
  costBasis: number;
  currentPrice: number | null;
  currentValue: number | null;
  pnlPct: number | null;
};

type Props = {
  rows: HoldingRow[];
  totalValue: number | null;
  totalPnlPct: number | null;
};

type Status = "idle" | "loading" | "done" | "error";

function buildPayload(
  rows: HoldingRow[],
  totalValue: number | null,
  totalPnlPct: number | null,
): InsightRequest {
  const holdings: PortfolioHoldingContext[] = rows.map((r) => ({
    ticker: r.ticker,
    shares: r.shares,
    costBasis: r.costBasis,
    currentPrice: r.currentPrice,
    currentValue: r.currentValue,
    pnlPct: r.pnlPct,
    allocationPct:
      r.currentValue != null && totalValue != null && totalValue > 0
        ? (r.currentValue / totalValue) * 100
        : null,
  }));

  return {
    // Minimal sectors/marketIndicators — the route uses portfolioContext branch
    sectors: [],
    marketIndicators: { spy: null, qqq: null, vix: null },
    portfolioContext: {
      holdings,
      totalValue,
      totalPnlPct,
    },
  };
}

export default function PortfolioInsight({ rows, totalValue, totalPnlPct }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch on mount when there are holdings with live prices
  const hasLivePrices = rows.some((r) => r.currentPrice != null);

  useEffect(() => {
    if (!hasLivePrices || rows.length === 0) return;
    void fetchDigest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => r.ticker).join(",")]);

  async function fetchDigest() {
    setStatus("loading");
    setInsight(null);
    setError(null);
    try {
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(rows, totalValue, totalPnlPct)),
      });
      const json = (await res.json()) as { insight?: string; error?: string };
      if (!res.ok || json.error) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setInsight(json.insight ?? "");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get digest");
      setStatus("error");
    }
  }

  if (rows.length === 0 || !hasLivePrices) return null;

  return (
    <section className="rounded-lg border border-violet-500/20 bg-violet-50/50 px-4 py-3 dark:border-violet-400/15 dark:bg-violet-950/20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">✦</span>
          <h2 className="font-mono text-sm font-semibold tracking-tight text-violet-900 dark:text-violet-300">
            Portfolio Digest
          </h2>
        </div>
        <button
          onClick={() => void fetchDigest()}
          disabled={status === "loading"}
          className="rounded-md border border-violet-400/30 bg-violet-100 px-3 py-1 text-xs font-medium text-violet-800 hover:bg-violet-200 disabled:opacity-50 dark:border-violet-400/20 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50 transition-colors"
        >
          {status === "loading" ? "Analyzing…" : "Refresh"}
        </button>
      </div>

      {status === "loading" && (
        <div className="mt-3 flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
          Generating portfolio digest…
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
            onClick={() => void fetchDigest()}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {status === "done" && (
        <div className="mt-2 text-[10px] text-zinc-400">
          Powered by Claude · Based on your current holdings and live prices
        </div>
      )}
    </section>
  );
}
