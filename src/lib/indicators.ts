import { RSI, MACD } from "technicalindicators";

export type Series = (number | null)[];

export type IndicatorBundle = {
  sma20: Series;
  sma50: Series;
  ema20: Series;
  ema50: Series;
  rsi14: Series;
  macd: {
    macd: Series;
    signal: Series;
    histogram: Series;
  };
};

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function alignTrailing<T>(values: T[], targetLength: number): (T | null)[] {
  const out: (T | null)[] = new Array(targetLength).fill(null);
  const offset = targetLength - values.length;
  for (let i = 0; i < values.length; i++) {
    out[offset + i] = values[i];
  }
  return out;
}

export function computeIndicators(closes: number[]): IndicatorBundle {
  const len = closes.length;

  const rsiRaw = RSI.calculate({ period: 14, values: closes });
  const rsi14 = alignTrailing<number>(rsiRaw, len) as Series;

  const macdRaw = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const macdLine: Series = new Array(len).fill(null);
  const signalLine: Series = new Array(len).fill(null);
  const histLine: Series = new Array(len).fill(null);
  const macdOffset = len - macdRaw.length;
  for (let i = 0; i < macdRaw.length; i++) {
    const idx = macdOffset + i;
    const m = macdRaw[i];
    macdLine[idx] = m.MACD ?? null;
    signalLine[idx] = m.signal ?? null;
    histLine[idx] = m.histogram ?? null;
  }

  return {
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    ema20: ema(closes, 20),
    ema50: ema(closes, 50),
    rsi14,
    macd: { macd: macdLine, signal: signalLine, histogram: histLine },
  };
}
