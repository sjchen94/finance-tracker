import { NextRequest, NextResponse } from "next/server";
import { provider } from "@/lib/providers";
import type { HistoryInterval, HistoryRange } from "@/lib/providers/types";
import { computeIndicators } from "@/lib/indicators";
import { readCache, writeCache } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_RANGES: HistoryRange[] = [
  "1d",
  "5d",
  "1mo",
  "3mo",
  "6mo",
  "1y",
  "5y",
  "max",
];

const VALID_INTERVALS: HistoryInterval[] = [
  "1m",
  "5m",
  "15m",
  "30m",
  "60m",
  "1d",
  "1wk",
  "1mo",
];

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

export async function GET(req: NextRequest) {
  const symbolRaw = req.nextUrl.searchParams.get("symbol");
  const rangeRaw = (req.nextUrl.searchParams.get("range") ?? "6mo") as HistoryRange;
  const intervalRaw = req.nextUrl.searchParams.get("interval") as HistoryInterval | null;

  if (!symbolRaw) {
    return NextResponse.json({ error: "missing symbol" }, { status: 400 });
  }
  const symbol = symbolRaw.trim().toUpperCase();
  if (!/^[A-Z0-9.\-=^]+$/.test(symbol)) {
    return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  }
  if (!VALID_RANGES.includes(rangeRaw)) {
    return NextResponse.json({ error: "invalid range" }, { status: 400 });
  }
  const interval = intervalRaw ?? DEFAULT_INTERVAL[rangeRaw];
  if (!VALID_INTERVALS.includes(interval)) {
    return NextResponse.json({ error: "invalid interval" }, { status: 400 });
  }

  let history = await readCache(symbol, rangeRaw, interval);
  if (!history) {
    try {
      history = await provider.fetchHistory(symbol, rangeRaw, interval);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fetch failed";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    await writeCache(symbol, rangeRaw, interval, history);
  }

  const closes = history.candles.map((c) => c.close);
  const indicators = computeIndicators(closes);

  return NextResponse.json({
    meta: history.meta,
    candles: history.candles,
    indicators,
  });
}
