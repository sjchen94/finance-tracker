"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import HeaderBar from "./HeaderBar";
import Leaderboard from "./Leaderboard";
import SectorCard from "./SectorCard";
import FilterBar from "./FilterBar";
import InsightPanel from "./InsightPanel";
import StreakWidget from "./StreakWidget";
import AlertsBanner from "./AlertsBanner";
import ScreenerChat from "./ScreenerChat";
import {
  type ClientFilter,
  DEFAULT_FILTER,
  type SectorBundle,
  type SectorData,
  type TickerData,
  tickerPasses,
} from "./types";

const REFRESH_MS = 15 * 60_000;
type ViewMode = "simple" | "detailed";

function useLocalStorage<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    },
    [key],
  );

  return [value, set];
}

export default function MomentumDashboard() {
  const [bundle, setBundle] = useState<SectorBundle | null>(null);
  const [filter, setFilter] = useState<ClientFilter>({ ...DEFAULT_FILTER });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>("ft-view-mode", "detailed");
  const [highlightedSymbols, setHighlightedSymbols] = useState<Set<string>>(new Set());

  const load = useCallback(async (force = false) => {
    setRefreshing(true);
    setError(null);
    try {
      const url = force ? "/api/sectors?refresh=1" : "/api/sectors";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SectorBundle;
      setBundle(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
    const id = setInterval(() => {
      void load();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const filteredSectors = useMemo<SectorData[]>(() => {
    if (!bundle) return [];
    return bundle.sectors.map((s) => ({
      ...s,
      tickers: s.tickers.filter((t) => tickerPasses(t, filter)),
    }));
  }, [bundle, filter]);

  const allFilteredTickers: TickerData[] = useMemo(
    () => filteredSectors.flatMap((s) => s.tickers),
    [filteredSectors],
  );

  if (!bundle && !error) {
    return (
      <div className="flex items-center justify-center px-6 py-16 text-sm text-zinc-500">
        Loading momentum data…
      </div>
    );
  }

  if (error && !bundle) {
    return (
      <div className="px-6 py-12">
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          Failed to load momentum data: {error}
          <button
            onClick={() => load(true)}
            className="ml-3 rounded border border-red-500/30 px-2 py-0.5 text-xs hover:bg-red-500/10"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!bundle) return null;

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
      <HeaderBar
        spy={bundle.marketIndicators.spy}
        qqq={bundle.marketIndicators.qqq}
        vix={bundle.marketIndicators.vix}
        generatedAt={bundle.generatedAt}
        refreshing={refreshing}
        onRefresh={() => load(true)}
      />

      {/* View mode toggle */}
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
          <button
            onClick={() => setViewMode("simple")}
            className={`rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "simple"
                ? "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Simple
          </button>
          <button
            onClick={() => setViewMode("detailed")}
            className={`rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "detailed"
                ? "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Detailed
          </button>
        </div>
      </div>

      {viewMode === "detailed" && (
        <FilterBar filter={filter} onChange={setFilter} />
      )}

      {error && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Refresh error: {error} (showing last cached data)
        </div>
      )}

      {/* Proactive alerts — auto-fires on load when breakouts present */}
      <AlertsBanner bundle={bundle} />

      <Leaderboard tickers={allFilteredTickers} limit={10} highlightedSymbols={highlightedSymbols} />

      {viewMode === "detailed" && (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <StreakWidget sectors={filteredSectors} />
            <InsightPanel bundle={bundle} />
          </div>

          <ScreenerChat
            bundle={bundle}
            onResults={setHighlightedSymbols}
            highlightedSymbols={highlightedSymbols}
          />

          <section>
            <header className="mb-2 flex items-baseline justify-between">
              <h2 className="font-mono text-sm font-semibold tracking-tight">
                Sectors ({filteredSectors.length})
              </h2>
              <span className="text-xs text-zinc-500">
                Sorted by avg momentum
              </span>
            </header>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredSectors.map((s) => (
                <SectorCard key={s.id} sector={s} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
