"use client";

import { useEffect, useRef } from "react";
import { createChart, LineSeries, type IChartApi, type UTCTimestamp } from "lightweight-charts";

type SparklineProps = {
  closes: number[];
  width?: number;
  height?: number;
};

export default function Sparkline({ closes, width = 72, height = 28 }: SparklineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || closes.length < 2) return;

    const isDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;

    const first = closes[0]!;
    const last = closes[closes.length - 1]!;
    const up = last >= first;
    const color = up ? "#16a34a" : "#dc2626";

    const chart = createChart(el, {
      width,
      height,
      layout: {
        background: { color: "transparent" },
        textColor: "transparent",
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: false, borderVisible: false },
      crosshair: { horzLine: { visible: false }, vertLine: { visible: false } },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;

    const lineSeries = chart.addSeries(LineSeries, {
      color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // Fake unix timestamps spaced 1 day apart from a base
    const baseTime = 1700000000;
    lineSeries.setData(
      closes.map((v, i) => ({
        time: (baseTime + i * 86400) as UTCTimestamp,
        value: v,
      })),
    );

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [closes, width, height]);

  if (closes.length < 2) {
    return <div style={{ width, height }} className="opacity-20 bg-zinc-300 rounded" />;
  }

  return (
    <div
      ref={containerRef}
      style={{ width, height, overflow: "hidden" }}
      aria-hidden="true"
    />
  );
}
