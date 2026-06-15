import { sma, ema, type Series } from "@/lib/indicators";
import { RSI } from "technicalindicators";
import type { Candle } from "@/lib/providers/types";

export type MomentumComponents = {
  return1m: number | null;
  return3m: number | null;
  volumeSurge: number | null;
  relativeStrength: number | null;
  maTrend: number | null;
};

export type MomentumResult = {
  symbol: string;
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
  components: MomentumComponents;
  score: number;
  breakout: boolean;
};

const WEIGHTS = {
  return1m: 0.30,
  return3m: 0.20,
  volumeSurge: 0.20,
  relativeStrength: 0.15,
  maTrend: 0.15,
};

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function mapToScore(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 50;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function pctReturn(closes: number[], lookback: number): number | null {
  if (closes.length <= lookback) return null;
  const end = closes[closes.length - 1];
  const start = closes[closes.length - 1 - lookback];
  if (!start || start === 0) return null;
  return ((end - start) / start) * 100;
}

function avgVolume(volumes: number[], period: number): number | null {
  if (volumes.length < period) return null;
  const tail = volumes.slice(-period);
  const sum = tail.reduce((a, b) => a + b, 0);
  return sum / period;
}

function lastNonNull(series: Series): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) return series[i] as number;
  }
  return null;
}

function macdSignalDirection(closes: number[]): "bullish" | "bearish" | "neutral" {
  if (closes.length < 35) return "neutral";
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdSeries: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const a = ema12[i];
    const b = ema26[i];
    if (a != null && b != null) macdSeries.push(a - b);
  }
  if (macdSeries.length < 10) return "neutral";
  const signalSeries = ema(macdSeries, 9);
  const lastMacd = macdSeries[macdSeries.length - 1];
  const lastSig = lastNonNull(signalSeries);
  if (lastMacd == null || lastSig == null) return "neutral";
  if (lastMacd > lastSig) return "bullish";
  if (lastMacd < lastSig) return "bearish";
  return "neutral";
}

export function computeMomentum(
  symbol: string,
  candles: Candle[],
  benchmarkCandles?: Candle[],
): MomentumResult {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const price = last?.close ?? null;
  const dayChangePct =
    last && prev && prev.close
      ? ((last.close - prev.close) / prev.close) * 100
      : null;

  // Returns
  const return1m = pctReturn(closes, 21);
  const return3m = pctReturn(closes, 63);

  // Volume surge
  const avgVol30 = avgVolume(volumes, 30);
  const lastVol = last?.volume ?? null;
  const volumeSurge =
    avgVol30 && avgVol30 > 0 && lastVol != null ? lastVol / avgVol30 : null;

  // Relative strength vs benchmark (30-session return delta)
  let relativeStrength: number | null = null;
  if (benchmarkCandles && benchmarkCandles.length > 30) {
    const benchCloses = benchmarkCandles.map((c) => c.close);
    const benchRet = pctReturn(benchCloses, 30);
    const ownRet = pctReturn(closes, 30);
    if (benchRet != null && ownRet != null) {
      relativeStrength = ownRet - benchRet;
    }
  }

  // MAs
  const sma20Series = sma(closes, 20);
  const sma50Series = sma(closes, 50);
  const sma200Series = sma(closes, 200);
  const sma20 = sma20Series[sma20Series.length - 1];
  const sma50 = sma50Series[sma50Series.length - 1];
  const sma200 = sma200Series[sma200Series.length - 1];
  const above20d = price != null && sma20 != null ? price > sma20 : null;
  const above50d = price != null && sma50 != null ? price > sma50 : null;
  const above200d = price != null && sma200 != null ? price > sma200 : null;
  const maTrendCount =
    (above20d ? 1 : 0) + (above50d ? 1 : 0) + (above200d ? 1 : 0);
  const maTrend = (maTrendCount / 3) * 100;

  // RSI
  const rsiSeries = RSI.calculate({ period: 14, values: closes });
  const rsi = rsiSeries.length ? rsiSeries[rsiSeries.length - 1] : null;

  // MACD signal
  const macdSignal: "bullish" | "bearish" | "neutral" | null =
    closes.length >= 35 ? macdSignalDirection(closes) : null;

  // 52w high/low
  const lookback = Math.min(252, candles.length);
  const yearHighs = highs.slice(-lookback);
  const yearLows = lows.slice(-lookback);
  const high52 = yearHighs.length ? Math.max(...yearHighs) : null;
  const low52 = yearLows.length ? Math.min(...yearLows) : null;
  const pctFrom52wHigh =
    price != null && high52 != null && high52 !== 0
      ? ((price - high52) / high52) * 100
      : null;
  const pctFrom52wLow =
    price != null && low52 != null && low52 !== 0
      ? ((price - low52) / low52) * 100
      : null;

  // Normalized component scores 0..100
  const r1mScore = return1m != null ? mapToScore(return1m, -20, 20) : 50;
  const r3mScore = return3m != null ? mapToScore(return3m, -30, 30) : 50;
  const volScore =
    volumeSurge != null ? mapToScore(volumeSurge, 0.5, 2.5) : 50;
  const rsScore =
    relativeStrength != null ? mapToScore(relativeStrength, -15, 15) : 50;
  const maScore = maTrend;

  const score =
    r1mScore * WEIGHTS.return1m +
    r3mScore * WEIGHTS.return3m +
    volScore * WEIGHTS.volumeSurge +
    rsScore * WEIGHTS.relativeStrength +
    maScore * WEIGHTS.maTrend;

  // Breakout flag
  let crossedAbove50dRecently = false;
  if (sma50 != null && closes.length >= 51) {
    const recent = 5;
    for (let i = Math.max(1, closes.length - recent); i < closes.length; i++) {
      const c = closes[i];
      const cPrev = closes[i - 1];
      const m = sma50Series[i];
      const mPrev = sma50Series[i - 1];
      if (c != null && cPrev != null && m != null && mPrev != null) {
        if (cPrev <= mPrev && c > m) {
          crossedAbove50dRecently = true;
          break;
        }
      }
    }
  }
  const breakout =
    crossedAbove50dRecently &&
    rsi != null &&
    rsi >= 50 &&
    rsi <= 70 &&
    volumeSurge != null &&
    volumeSurge > 1.5 &&
    score > 65;

  return {
    symbol,
    price,
    changePercent: dayChangePct,
    volume: lastVol,
    volumeSurge,
    rsi,
    macdSignal,
    above20d,
    above50d,
    above200d,
    pctFrom52wHigh,
    pctFrom52wLow,
    return1m,
    return3m,
    relativeStrength,
    components: {
      return1m: r1mScore,
      return3m: r3mScore,
      volumeSurge: volScore,
      relativeStrength: rsScore,
      maTrend: maScore,
    },
    score: Math.round(score * 10) / 10,
    breakout,
  };
}
