export type HistoryRange =
  | "1d"
  | "5d"
  | "1mo"
  | "3mo"
  | "6mo"
  | "1y"
  | "5y"
  | "max";

export type HistoryInterval =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "60m"
  | "1d"
  | "1wk"
  | "1mo";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type HistoryMeta = {
  symbol: string;
  currency: string;
  exchange: string | null;
  shortName: string | null;
  interval: HistoryInterval;
  range: HistoryRange;
};

export type HistoryResult = {
  meta: HistoryMeta;
  candles: Candle[];
};

export interface MarketDataProvider {
  name: string;
  fetchHistory(
    symbol: string,
    range: HistoryRange,
    interval: HistoryInterval,
  ): Promise<HistoryResult>;
}
