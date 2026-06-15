"use client";

import { useEffect, useRef, useState } from "react";
import type { SectorBundle } from "./types";
import type { Alert, AlertsRequest } from "@/app/api/alerts/route";

function buildPayload(bundle: SectorBundle): AlertsRequest {
  return {
    sectors: bundle.sectors.map((s) => ({
      name: s.name,
      averageScore: s.averageScore,
      topTickers: [...s.tickers]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
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

const LEVEL_STYLES: Record<Alert["level"], { bg: string; border: string; icon: string; label: string }> = {
  breakout: {
    bg: "bg-emerald-50/80 dark:bg-emerald-950/30",
    border: "border-emerald-500/30",
    icon: "⚡",
    label: "Breakout",
  },
  anomaly: {
    bg: "bg-amber-50/80 dark:bg-amber-950/30",
    border: "border-amber-500/30",
    icon: "⚠",
    label: "Anomaly",
  },
  watch: {
    bg: "bg-blue-50/80 dark:bg-blue-950/30",
    border: "border-blue-500/30",
    icon: "👁",
    label: "Watch",
  },
};

export default function AlertsBanner({ bundle }: { bundle: SectorBundle }) {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  // Check if there are any breakout signals — only auto-fetch if so
  const hasBreakouts = bundle.sectors.some((s) =>
    s.tickers.some((t) => t.breakout),
  );
  const vixHigh =
    bundle.marketIndicators.vix?.price != null &&
    bundle.marketIndicators.vix.price > 25;

  useEffect(() => {
    if (fetchedRef.current) return;
    if (!hasBreakouts && !vixHigh) {
      setAlerts([]);
      return;
    }
    fetchedRef.current = true;
    setLoading(true);
    fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(bundle)),
    })
      .then((r) => r.json())
      .then((data: { alerts?: Alert[] }) => {
        setAlerts(data.alerts ?? []);
      })
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  // Run once when bundle first arrives
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleAlerts = (alerts ?? []).filter((a) => !dismissed.has(a.id));

  if (!loading && visibleAlerts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-50/40 px-3 py-2 text-xs text-violet-700 dark:bg-violet-950/20 dark:text-violet-400">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
          Scanning for pattern alerts…
        </div>
      )}
      {visibleAlerts.map((alert) => {
        const style = LEVEL_STYLES[alert.level];
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${style.bg} ${style.border}`}
          >
            <span className="mt-0.5 text-sm">{style.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide opacity-60">
                  {style.label}
                </span>
                {alert.ticker && (
                  <span className="font-mono text-xs font-bold">{alert.ticker}</span>
                )}
                <span className="text-xs font-medium">{alert.headline}</span>
              </div>
              <p className="mt-0.5 text-xs opacity-70">{alert.detail}</p>
            </div>
            <button
              onClick={() => setDismissed((prev) => new Set([...prev, alert.id]))}
              className="mt-0.5 text-xs opacity-40 hover:opacity-70"
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
