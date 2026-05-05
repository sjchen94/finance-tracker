"use client";

import { useEffect, useState } from "react";

type Quote = {
  symbol: string;
  shortName: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string;
  marketState: string | null;
  exchange: string | null;
};

const STORAGE_KEY = "finance-tracker:watchlist";
const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "NVDA", "GOOGL", "TSLA"];

function loadInitialSymbols(): string[] {
  if (typeof window === "undefined") return DEFAULT_SYMBOLS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SYMBOLS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
      return parsed.length ? parsed : DEFAULT_SYMBOLS;
    }
  } catch {
    // fall through
  }
  return DEFAULT_SYMBOLS;
}

export default function Watchlist() {
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    setSymbols(loadInitialSymbols());
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
    }
  }, [symbols]);

  useEffect(() => {
    let cancelled = false;
    if (symbols.length === 0) {
      setQuotes([]);
      return;
    }

    async function fetchQuotes() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/quote?symbols=${symbols.join(",")}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setQuotes(data.quotes ?? []);
        setUpdatedAt(new Date());
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "fetch failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchQuotes();
    const id = setInterval(fetchQuotes, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbols]);

  function addSymbol(e: React.FormEvent) {
    e.preventDefault();
    const next = input.trim().toUpperCase();
    if (!next) return;
    if (!symbols.includes(next)) setSymbols([...symbols, next]);
    setInput("");
  }

  function removeSymbol(symbol: string) {
    setSymbols(symbols.filter((s) => s !== symbol));
  }

  return (
    <div className="w-full max-w-3xl">
      <form onSubmit={addSymbol} className="flex gap-2 mb-6">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add ticker (e.g. AMZN)"
          className="flex-1 rounded-md border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:focus:border-white/40"
        />
        <button
          type="submit"
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          Add
        </button>
      </form>

      <div className="flex items-center justify-between mb-3 text-xs text-black/60 dark:text-white/60">
        <span>{loading ? "Refreshing…" : updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : ""}</span>
        {error && <span className="text-red-500">{error}</span>}
      </div>

      <ul className="divide-y divide-black/10 dark:divide-white/15 rounded-lg border border-black/10 dark:border-white/15">
        {quotes.length === 0 && !loading && (
          <li className="px-4 py-6 text-sm text-black/60 dark:text-white/60 text-center">
            No tickers yet. Add one above.
          </li>
        )}
        {quotes.map((q) => {
          const isUp = (q.change ?? 0) >= 0;
          return (
            <li key={q.symbol} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-semibold">{q.symbol}</div>
                <div className="text-xs text-black/60 dark:text-white/60 truncate">{q.shortName}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">
                  {q.price !== null ? q.price.toFixed(2) : "—"} {q.currency}
                </div>
                <div className={`font-mono text-xs ${isUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {q.change !== null && q.changePercent !== null
                    ? `${isUp ? "+" : ""}${q.change.toFixed(2)} (${isUp ? "+" : ""}${q.changePercent.toFixed(2)}%)`
                    : "—"}
                </div>
              </div>
              <button
                onClick={() => removeSymbol(q.symbol)}
                className="text-xs text-black/40 hover:text-red-500 dark:text-white/40"
                aria-label={`Remove ${q.symbol}`}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
