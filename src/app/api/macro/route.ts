import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

/**
 * Macro Indicator API
 *
 * Fetches key macro quotes via the existing Yahoo Finance provider:
 *   ^TNX    — 10-Year Treasury yield
 *   DX-Y.NYB — US Dollar Index (DXY)
 *   ^IRX    — 13-Week T-Bill yield
 *
 * Cached in-memory for 30 minutes (macro indicators move slowly intraday and
 * this keeps the HeaderBar cheap to poll alongside the sectors bundle).
 */

export const runtime = "nodejs";

const yahooFinance = new YahooFinance();

const CACHE_TTL_MS = 30 * 60_000;

export type MacroQuote = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
};

export type MacroBundle = {
  generatedAt: number;
  tenYear: MacroQuote | null;
  dxy: MacroQuote | null;
  tBill: MacroQuote | null;
};

type RawQuote = {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
};

let cache: { storedAt: number; payload: MacroBundle } | null = null;

function quoteSummary(symbol: string, q: RawQuote | undefined): MacroQuote | null {
  if (!q) return null;
  return {
    symbol,
    price: q.regularMarketPrice ?? null,
    changePercent: q.regularMarketChangePercent ?? null,
  };
}

async function fetchMacroBundle(): Promise<MacroBundle> {
  const symbols = ["^TNX", "DX-Y.NYB", "^IRX"];
  const map = new Map<string, RawQuote>();
  try {
    const result = (await yahooFinance.quote(symbols)) as unknown as RawQuote | RawQuote[];
    const list: RawQuote[] = Array.isArray(result) ? result : [result];
    for (const q of list) {
      if (q && q.symbol) map.set(q.symbol.toUpperCase(), q);
    }
  } catch (e) {
    console.warn("[macro] quote fetch failed:", e instanceof Error ? e.message : e);
  }

  return {
    generatedAt: Date.now(),
    tenYear: quoteSummary("^TNX", map.get("^TNX")),
    dxy: quoteSummary("DX-Y.NYB", map.get("DX-Y.NYB")),
    tBill: quoteSummary("^IRX", map.get("^IRX")),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  if (!forceRefresh && cache && Date.now() - cache.storedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.payload);
  }

  const payload = await fetchMacroBundle();
  cache = { storedAt: Date.now(), payload };
  return NextResponse.json(payload);
}
