"use client";

import { useRef, useState } from "react";
import type { SectorBundle } from "./types";
import type { ScreenerMatch } from "@/app/api/screener/route";

type ScreenerChatProps = {
  bundle: SectorBundle;
  onResults: (symbols: Set<string>) => void;
  highlightedSymbols: Set<string>;
};

const EXAMPLE_QUERIES = [
  "RSI under 40 with strong 3-month returns",
  "Breakout tickers above 50-day MA",
  "High volume surge with bullish MACD",
  "Tech sector with score above 70",
];

export default function ScreenerChat({
  bundle,
  onResults,
  highlightedSymbols,
}: ScreenerChatProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<ScreenerMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runScreen(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setMatches(null);
    onResults(new Set());

    try {
      const res = await fetch("/api/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectors: bundle.sectors.map((s) => ({
            name: s.name,
            averageScore: s.averageScore,
            tickers: s.tickers.map((t) => ({
              symbol: t.symbol,
              score: t.score,
              changePercent: t.changePercent,
              breakout: t.breakout,
              rsi: t.rsi,
              return1m: t.return1m,
              return3m: t.return3m,
              above50d: t.above50d,
              above200d: t.above200d,
              volumeSurge: t.volumeSurge,
              macdSignal: t.macdSignal,
            })),
          })),
          marketIndicators: bundle.marketIndicators,
          query: trimmed,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { matches: ScreenerMatch[] };
      setMatches(data.matches);
      onResults(new Set(data.matches.map((m) => m.symbol)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screener failed");
    } finally {
      setLoading(false);
    }
  }

  function clearResults() {
    setMatches(null);
    setError(null);
    setQuery("");
    onResults(new Set());
  }

  const hasResults = matches !== null;

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header className="border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="font-mono text-sm font-semibold tracking-tight">Natural Language Screener</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Describe what you&apos;re looking for — Claude will scan {bundle.sectors.reduce((n, s) => n + s.tickers.length, 0)} tickers and highlight matches in the leaderboard.
        </p>
      </header>

      <div className="p-4">
        {/* Input row */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runScreen(query);
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. breakout tickers with RSI under 50 in tech…"
            disabled={loading}
            className="flex-1 rounded border border-black/20 bg-zinc-50 px-3 py-1.5 text-sm dark:border-white/20 dark:bg-zinc-800 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Screening…" : "Screen"}
          </button>
          {hasResults && (
            <button
              type="button"
              onClick={clearResults}
              className="rounded-md border border-black/20 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-white/20 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Clear
            </button>
          )}
        </form>

        {/* Example queries */}
        {!hasResults && !loading && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLE_QUERIES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setQuery(ex);
                  void runScreen(ex);
                }}
                className="rounded-full border border-black/10 px-2.5 py-0.5 text-[11px] text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-white/10 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Results */}
        {hasResults && matches !== null && (
          <div className="mt-3">
            {matches.length === 0 ? (
              <p className="text-sm text-zinc-500">No tickers matched your query.</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-zinc-500">
                  {matches.length} match{matches.length !== 1 ? "es" : ""} — highlighted in leaderboard above
                </p>
                <ul className="divide-y divide-black/10 dark:divide-white/10">
                  {matches.map((m) => {
                    const highlighted = highlightedSymbols.has(m.symbol);
                    return (
                      <li
                        key={m.symbol}
                        className={`flex items-start gap-3 py-2 ${highlighted ? "" : ""}`}
                      >
                        <span className="mt-0.5 w-14 shrink-0 font-mono text-sm font-semibold">
                          {m.symbol}
                        </span>
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">{m.reason}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
