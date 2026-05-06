import YahooFinance from "yahoo-finance2";
import type {
  Candle,
  HistoryInterval,
  HistoryRange,
  HistoryResult,
  MarketDataProvider,
} from "./types";

const yahooFinance = new YahooFinance();

const DAY_MS = 24 * 60 * 60 * 1000;

function rangeToPeriod1(range: HistoryRange): Date {
  const now = Date.now();
  switch (range) {
    case "1d":
      return new Date(now - 2 * DAY_MS);
    case "5d":
      return new Date(now - 7 * DAY_MS);
    case "1mo":
      return new Date(now - 31 * DAY_MS);
    case "3mo":
      return new Date(now - 92 * DAY_MS);
    case "6mo":
      return new Date(now - 183 * DAY_MS);
    case "1y":
      return new Date(now - 366 * DAY_MS);
    case "5y":
      return new Date(now - 5 * 366 * DAY_MS);
    case "max":
      return new Date("1970-01-01");
  }
}

export const yahooProvider: MarketDataProvider = {
  name: "yahoo",
  async fetchHistory(
    symbol: string,
    range: HistoryRange,
    interval: HistoryInterval,
  ): Promise<HistoryResult> {
    const result = await yahooFinance.chart(symbol, {
      period1: rangeToPeriod1(range),
      interval,
      return: "array",
    });

    const candles: Candle[] = [];
    for (const q of result.quotes) {
      if (
        q.open == null ||
        q.high == null ||
        q.low == null ||
        q.close == null
      ) {
        continue;
      }
      candles.push({
        time: Math.floor(q.date.getTime() / 1000),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume ?? 0,
      });
    }

    return {
      meta: {
        symbol: result.meta.symbol ?? symbol.toUpperCase(),
        currency: result.meta.currency ?? "USD",
        exchange:
          result.meta.fullExchangeName ?? result.meta.exchangeName ?? null,
        shortName: result.meta.shortName ?? result.meta.longName ?? null,
        interval,
        range,
      },
      candles,
    };
  },
};
