import { promises as fs } from "fs";
import path from "path";
import os from "os";
import YahooFinance from "yahoo-finance2";
import { provider } from "@/lib/providers";
import type { HistoryResult } from "@/lib/providers/types";
import { readCache, writeCache } from "@/lib/cache";
import {
  BENCHMARK_SYMBOL,
  SECTORS,
  TICKER_TO_SECTOR,
  type SectorDef,
  type SectorId,
} from "./sectors";
import { computeMomentum, type MomentumResult } from "./scorer";

const yahooFinance = new YahooFinance();

const SECTOR_CACHE_TTL_MS = 15 * 60_000;
const SECTOR_CACHE_FILE = path.join(
  process.env.FINANCE_TRACKER_CACHE_DIR ?? path.join(os.tmpdir(), "finance-tracker-cache"),
  "sectors.json",
);

export type TickerData = MomentumResult & {
  sector: { id: SectorId; name: string };
  shortName: string | null;
  marketCap: number | null;
};

export type SectorData = {
  id: SectorId;
  name: string;
  averageScore: number;
  tickers: TickerData[];
};

export type SectorBundle = {
  generatedAt: number;
  sectors: SectorData[];
  benchmark: {
    symbol: string;
    price: number | null;
    changePercent: number | null;
  };
  marketIndicators: {
    spy: QuoteSummary | null;
    qqq: QuoteSummary | null;
    vix: QuoteSummary | null;
  };
};

type QuoteSummary = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
};

type CacheRecord = {
  storedAt: number;
  payload: SectorBundle;
};

type RawQuote = {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  marketCap?: number;
};

async function readSectorCache(): Promise<SectorBundle | null> {
  try {
    const raw = await fs.readFile(SECTOR_CACHE_FILE, "utf8");
    const rec = JSON.parse(raw) as CacheRecord;
    if (Date.now() - rec.storedAt > SECTOR_CACHE_TTL_MS) return null;
    return rec.payload;
  } catch {
    return null;
  }
}

async function writeSectorCache(payload: SectorBundle): Promise<void> {
  await fs.mkdir(path.dirname(SECTOR_CACHE_FILE), { recursive: true });
  const rec: CacheRecord = { storedAt: Date.now(), payload };
  await fs.writeFile(SECTOR_CACHE_FILE, JSON.stringify(rec), "utf8");
}

async function fetchHistorySafe(symbol: string): Promise<HistoryResult | null> {
  // 1y daily so the 200-day MA can be computed
  const range = "1y" as const;
  const interval = "1d" as const;
  const cached = await readCache(symbol, range, interval);
  if (cached) return cached;
  try {
    const h = await provider.fetchHistory(symbol, range, interval);
    await writeCache(symbol, range, interval, h);
    return h;
  } catch (e) {
    console.warn(`[momentum] history fetch failed for ${symbol}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

async function fetchQuotesSafe(symbols: string[]): Promise<Map<string, RawQuote>> {
  const map = new Map<string, RawQuote>();
  if (symbols.length === 0) return map;
  try {
    const result = (await yahooFinance.quote(symbols)) as unknown as RawQuote | RawQuote[];
    const list: RawQuote[] = Array.isArray(result) ? result : [result];
    for (const q of list) {
      if (q && q.symbol) map.set(q.symbol.toUpperCase(), q);
    }
  } catch (e) {
    console.warn(`[momentum] quote fetch failed:`, e instanceof Error ? e.message : e);
  }
  return map;
}

function quoteSummary(symbol: string, q: RawQuote | undefined): QuoteSummary | null {
  if (!q) return null;
  return {
    symbol,
    price: q.regularMarketPrice ?? null,
    changePercent: q.regularMarketChangePercent ?? null,
  };
}

export async function fetchSectorData(options?: { forceRefresh?: boolean }): Promise<SectorBundle> {
  if (!options?.forceRefresh) {
    const cached = await readSectorCache();
    if (cached) return cached;
  }

  const allSymbols = Array.from(
    new Set([
      ...SECTORS.flatMap((s) => s.tickers),
      BENCHMARK_SYMBOL,
      "QQQ",
      "^VIX",
    ]),
  );

  // Fetch quotes (one batch) and histories (per symbol)
  const [quotes, ...histories] = await Promise.all([
    fetchQuotesSafe(allSymbols),
    ...allSymbols.map((s) => fetchHistorySafe(s)),
  ]);

  const historyBySymbol = new Map<string, HistoryResult | null>();
  allSymbols.forEach((s, i) => historyBySymbol.set(s, histories[i] ?? null));

  const benchmarkHistory = historyBySymbol.get(BENCHMARK_SYMBOL) ?? null;
  const benchmarkCandles = benchmarkHistory?.candles ?? [];

  const sectors: SectorData[] = SECTORS.map((def: SectorDef) => {
    const tickers: TickerData[] = def.tickers.map((sym) => {
      const hist = historyBySymbol.get(sym);
      const q = quotes.get(sym);
      const sector = TICKER_TO_SECTOR[sym];
      if (!hist || hist.candles.length === 0) {
        return {
          symbol: sym,
          price: q?.regularMarketPrice ?? null,
          changePercent: q?.regularMarketChangePercent ?? null,
          volume: null,
          volumeSurge: null,
          rsi: null,
          macdSignal: null,
          above20d: null,
          above50d: null,
          above200d: null,
          pctFrom52wHigh: null,
          pctFrom52wLow: null,
          return1m: null,
          return3m: null,
          relativeStrength: null,
          components: {
            return1m: 50,
            return3m: 50,
            volumeSurge: 50,
            relativeStrength: 50,
            maTrend: 50,
          },
          score: 50,
          breakout: false,
          sector,
          shortName: q?.shortName ?? q?.longName ?? null,
          marketCap: q?.marketCap ?? null,
        };
      }
      const m = computeMomentum(sym, hist.candles, benchmarkCandles);
      // Prefer live quote price/change if available
      const livePrice = q?.regularMarketPrice ?? m.price;
      const liveChange = q?.regularMarketChangePercent ?? m.changePercent;
      return {
        ...m,
        price: livePrice,
        changePercent: liveChange,
        sector,
        shortName: q?.shortName ?? q?.longName ?? null,
        marketCap: q?.marketCap ?? null,
      };
    });
    const valid = tickers.filter((t) => Number.isFinite(t.score));
    const avg = valid.length
      ? valid.reduce((a, b) => a + b.score, 0) / valid.length
      : 0;
    return {
      id: def.id,
      name: def.name,
      averageScore: Math.round(avg * 10) / 10,
      tickers,
    };
  });

  // Sort sectors by avg score desc
  sectors.sort((a, b) => b.averageScore - a.averageScore);

  const bundle: SectorBundle = {
    generatedAt: Date.now(),
    sectors,
    benchmark: {
      symbol: BENCHMARK_SYMBOL,
      price: quotes.get(BENCHMARK_SYMBOL)?.regularMarketPrice ?? null,
      changePercent: quotes.get(BENCHMARK_SYMBOL)?.regularMarketChangePercent ?? null,
    },
    marketIndicators: {
      spy: quoteSummary("SPY", quotes.get("SPY")),
      qqq: quoteSummary("QQQ", quotes.get("QQQ")),
      vix: quoteSummary("^VIX", quotes.get("^VIX")),
    },
  };

  await writeSectorCache(bundle);
  return bundle;
}

export function getSectorById(bundle: SectorBundle, id: string): SectorData | null {
  return bundle.sectors.find((s) => s.id === id) ?? null;
}

export function getLeaderboard(bundle: SectorBundle, limit = 10): TickerData[] {
  const all: TickerData[] = bundle.sectors.flatMap((s) => s.tickers);
  return all
    .filter((t) => Number.isFinite(t.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
