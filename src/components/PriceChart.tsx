"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Series = (number | null)[];

type Indicators = {
  sma20: Series;
  sma50: Series;
  ema20: Series;
  ema50: Series;
  rsi14: Series;
  macd: { macd: Series; signal: Series; histogram: Series };
};

export type PriceChartProps = {
  candles: Candle[];
  indicators: Indicators;
};

type LinePoint = { time: UTCTimestamp; value: number };
type HistPoint = { time: UTCTimestamp; value: number; color: string };

function toLineData(
  candles: Candle[],
  series: Series,
): LinePoint[] {
  const out: LinePoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    const v = series[i];
    if (v == null) continue;
    out.push({ time: candles[i].time as UTCTimestamp, value: v });
  }
  return out;
}

function toHistogramData(
  candles: Candle[],
  series: Series,
  upColor: string,
  downColor: string,
): HistPoint[] {
  const out: HistPoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    const v = series[i];
    if (v == null) continue;
    out.push({
      time: candles[i].time as UTCTimestamp,
      value: v,
      color: v >= 0 ? upColor : downColor,
    });
  }
  return out;
}

export default function PriceChart({ candles, indicators }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: isDark ? "#000000" : "#fafafa" },
        textColor: isDark ? "#d4d4d8" : "#27272a",
        panes: { separatorColor: isDark ? "#27272a" : "#e4e4e7", separatorHoverColor: "#71717a" },
      },
      grid: {
        vertLines: { color: isDark ? "#18181b" : "#e4e4e7" },
        horzLines: { color: isDark ? "#18181b" : "#e4e4e7" },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderVisible: false },
    });
    chartRef.current = chart;

    // Pane 0: Candles + SMA/EMA overlays
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    });
    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    const sma20Series = chart.addSeries(LineSeries, {
      color: "#2563eb",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "SMA 20",
    });
    sma20Series.setData(toLineData(candles, indicators.sma20));

    const sma50Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "SMA 50",
    });
    sma50Series.setData(toLineData(candles, indicators.sma50));

    const ema20Series = chart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "EMA 20",
    });
    ema20Series.setData(toLineData(candles, indicators.ema20));

    const ema50Series = chart.addSeries(LineSeries, {
      color: "#ec4899",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "EMA 50",
    });
    ema50Series.setData(toLineData(candles, indicators.ema50));

    // Pane 1: Volume
    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1,
    );
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color:
          c.close >= c.open
            ? "rgba(22,163,74,0.5)"
            : "rgba(220,38,38,0.5)",
      })),
    );

    // Pane 2: RSI
    const rsiSeries = chart.addSeries(
      LineSeries,
      {
        color: "#0ea5e9",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        title: "RSI 14",
      },
      2,
    );
    rsiSeries.setData(toLineData(candles, indicators.rsi14));
    rsiSeries.createPriceLine({
      price: 70,
      color: "#dc2626",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "70",
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: "#16a34a",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "30",
    });

    // Pane 3: MACD
    const macdHist = chart.addSeries(
      HistogramSeries,
      {
        priceLineVisible: false,
        lastValueVisible: false,
      },
      3,
    );
    macdHist.setData(
      toHistogramData(
        candles,
        indicators.macd.histogram,
        "rgba(22,163,74,0.5)",
        "rgba(220,38,38,0.5)",
      ),
    );

    const macdLine = chart.addSeries(
      LineSeries,
      {
        color: "#2563eb",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "MACD",
      },
      3,
    );
    macdLine.setData(toLineData(candles, indicators.macd.macd));

    const signalLine = chart.addSeries(
      LineSeries,
      {
        color: "#f59e0b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "Signal",
      },
      3,
    );
    signalLine.setData(toLineData(candles, indicators.macd.signal));

    // Pane heights: main candle pane gets the most, indicators get smaller fixed share
    const panes = chart.panes();
    if (panes[0]) panes[0].setHeight(360);
    if (panes[1]) panes[1].setHeight(80);
    if (panes[2]) panes[2].setHeight(110);
    if (panes[3]) panes[3].setHeight(110);

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, indicators]);

  return <div ref={containerRef} className="w-full h-[660px]" />;
}
