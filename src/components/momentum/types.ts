export type ClientFilter = {
  minRsi: number;
  maxRsi: number;
  above20d: boolean;
  above50d: boolean;
  above200d: boolean;
  minScore: number;
  breakoutOnly: boolean;
};

export const DEFAULT_FILTER: ClientFilter = {
  minRsi: 0,
  maxRsi: 100,
  above20d: false,
  above50d: false,
  above200d: false,
  minScore: 0,
  breakoutOnly: false,
};

export type TickerData = {
  symbol: string;
  shortName: string | null;
  sector: { id: string; name: string };
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  volumeSurge: number | null;
  rsi: number | null;
  macdSignal: "bullish" | "bearish" | "neutral" | null;
  above20d: boolean | null;
  above50d: boolean | null;
  above200d: boolean | null;
  pctFrom52wHigh: number | null;
  pctFrom52wLow: number | null;
  return1m: number | null;
  return3m: number | null;
  relativeStrength: number | null;
  marketCap: number | null;
  score: number;
  breakout: boolean;
};

export type SectorData = {
  id: string;
  name: string;
  averageScore: number;
  tickers: TickerData[];
};

export type MarketQuote = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
} | null;

export type SectorBundle = {
  generatedAt: number;
  sectors: SectorData[];
  benchmark: { symbol: string; price: number | null; changePercent: number | null };
  marketIndicators: {
    spy: MarketQuote;
    qqq: MarketQuote;
    vix: MarketQuote;
  };
};

export function tickerPasses(t: TickerData, f: ClientFilter): boolean {
  if (t.rsi != null) {
    if (t.rsi < f.minRsi || t.rsi > f.maxRsi) return false;
  }
  if (f.above20d && t.above20d !== true) return false;
  if (f.above50d && t.above50d !== true) return false;
  if (f.above200d && t.above200d !== true) return false;
  if (t.score < f.minScore) return false;
  if (f.breakoutOnly && !t.breakout) return false;
  return true;
}

export function scoreTier(score: number): {
  label: string;
  fg: string;
  bg: string;
} {
  if (score >= 80) return { label: "Strong", fg: "text-emerald-50", bg: "bg-emerald-600" };
  if (score >= 65) return { label: "Solid", fg: "text-green-50", bg: "bg-green-500" };
  if (score >= 50) return { label: "Neutral", fg: "text-zinc-50", bg: "bg-zinc-500" };
  if (score >= 35) return { label: "Weak", fg: "text-amber-50", bg: "bg-amber-500" };
  return { label: "Bearish", fg: "text-red-50", bg: "bg-red-500" };
}

export function formatMarketCap(mc: number | null): string {
  if (mc == null) return "—";
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `${(mc / 1e6).toFixed(0)}M`;
  return mc.toString();
}

export function formatPct(pct: number | null, digits = 2): string {
  if (pct == null) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}
