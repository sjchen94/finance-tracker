import Link from "next/link";
import { notFound } from "next/navigation";
import { provider } from "@/lib/providers";
import type {
  HistoryInterval,
  HistoryRange,
} from "@/lib/providers/types";
import { computeIndicators } from "@/lib/indicators";
import { readCache, writeCache } from "@/lib/cache";
import PriceChart from "@/components/PriceChart";

export const dynamic = "force-dynamic";

const RANGES: HistoryRange[] = ["1mo", "3mo", "6mo", "1y", "5y", "max"];

const DEFAULT_INTERVAL: Record<HistoryRange, HistoryInterval> = {
  "1d": "5m",
  "5d": "30m",
  "1mo": "1d",
  "3mo": "1d",
  "6mo": "1d",
  "1y": "1d",
  "5y": "1wk",
  max: "1mo",
};

type PageProps = {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ range?: string }>;
};

export default async function TickerPage({ params, searchParams }: PageProps) {
  const { symbol: rawSymbol } = await params;
  const { range: rawRange } = await searchParams;

  const symbol = decodeURIComponent(rawSymbol).trim().toUpperCase();
  if (!/^[A-Z0-9.\-=^]+$/.test(symbol)) {
    notFound();
  }

  const range: HistoryRange =
    rawRange && (RANGES as string[]).includes(rawRange)
      ? (rawRange as HistoryRange)
      : "6mo";
  const interval = DEFAULT_INTERVAL[range];

  let history = await readCache(symbol, range, interval);
  if (!history) {
    try {
      history = await provider.fetchHistory(symbol, range, interval);
    } catch (e) {
      const message = e instanceof Error ? e.message : "fetch failed";
      return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col items-center px-6 py-12">
          <div className="w-full max-w-5xl">
            <Link
              href="/"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              ← Back
            </Link>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight">
              {symbol}
            </h1>
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              Failed to load history: {message}
            </p>
          </div>
        </div>
      );
    }
    await writeCache(symbol, range, interval, history);
  }

  const indicators = computeIndicators(history.candles.map((c) => c.close));
  const last = history.candles[history.candles.length - 1];
  const first = history.candles[0];
  const rangeChange =
    last && first ? last.close - first.close : null;
  const rangeChangePct =
    last && first && first.close !== 0
      ? ((last.close - first.close) / first.close) * 100
      : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col items-center px-6 py-12 font-sans">
      <div className="w-full max-w-5xl">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to watchlist
        </Link>

        <header className="mt-6 flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-mono text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
              {history.meta.symbol}
            </h1>
            {history.meta.shortName && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {history.meta.shortName}
                {history.meta.exchange ? ` · ${history.meta.exchange}` : ""}
              </p>
            )}
          </div>
          {last && (
            <div className="text-right">
              <div className="font-mono text-2xl">
                {last.close.toFixed(2)}{" "}
                <span className="text-sm text-zinc-500">
                  {history.meta.currency}
                </span>
              </div>
              {rangeChange !== null && rangeChangePct !== null && (
                <div
                  className={`font-mono text-sm ${
                    rangeChange >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {rangeChange >= 0 ? "+" : ""}
                  {rangeChange.toFixed(2)} ({rangeChange >= 0 ? "+" : ""}
                  {rangeChangePct.toFixed(2)}%) over {range}
                </div>
              )}
            </div>
          )}
        </header>

        <nav className="mt-6 flex gap-2 flex-wrap">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/ticker/${encodeURIComponent(symbol)}?range=${r}`}
              className={`px-3 py-1 rounded-md text-xs font-mono border ${
                r === range
                  ? "border-black/30 bg-black/5 dark:border-white/30 dark:bg-white/10"
                  : "border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              {r}
            </Link>
          ))}
        </nav>

        <div className="mt-6 rounded-lg border border-black/10 dark:border-white/15 bg-white dark:bg-zinc-950 p-2">
          {history.candles.length === 0 ? (
            <div className="h-[660px] flex items-center justify-center text-sm text-zinc-500">
              No data for this range.
            </div>
          ) : (
            <PriceChart candles={history.candles} indicators={indicators} />
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Panes: price (with SMA 20/50, EMA 20/50) · volume · RSI 14 (Wilder) ·
          MACD 12/26/9. Data via Yahoo Finance. Not investment advice.
        </p>
      </div>
    </div>
  );
}
