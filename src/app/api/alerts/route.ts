import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { InsightRequest } from "@/app/api/insight/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Anthropic();

export type AlertsRequest = InsightRequest;

export type Alert = {
  id: string;
  level: "breakout" | "anomaly" | "watch";
  ticker: string | null;
  headline: string;
  detail: string;
};

export type AlertsResponse = {
  alerts: Alert[];
};

export async function POST(req: NextRequest) {
  let body: AlertsRequest;
  try {
    body = (await req.json()) as AlertsRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sectors, marketIndicators } = body;

  // Gather breakout tickers and anomalies to surface
  const breakouts = sectors
    .flatMap((s) =>
      s.topTickers
        .filter((t) => t.breakout)
        .map((t) => ({ ...t, sectorName: s.name })),
    )
    .slice(0, 8);

  const highRsi = sectors
    .flatMap((s) =>
      s.topTickers
        .filter((t) => t.rsi != null && t.rsi > 72)
        .map((t) => ({ ...t, sectorName: s.name })),
    )
    .slice(0, 4);

  const topGainers = sectors
    .flatMap((s) =>
      s.topTickers.map((t) => ({ ...t, sectorName: s.name })),
    )
    .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
    .slice(0, 5);

  // If nothing interesting, return empty
  const hasBreakouts = breakouts.length > 0;
  const hasAnomaly = highRsi.length > 0;
  const vixHigh =
    marketIndicators.vix?.price != null && marketIndicators.vix.price > 25;

  if (!hasBreakouts && !hasAnomaly && !vixHigh) {
    return NextResponse.json({ alerts: [] });
  }

  const dataLines: string[] = [
    `Market: SPY ${marketIndicators.spy?.changePercent != null ? (marketIndicators.spy.changePercent >= 0 ? "+" : "") + marketIndicators.spy.changePercent.toFixed(2) + "%" : "N/A"}, QQQ ${marketIndicators.qqq?.changePercent != null ? (marketIndicators.qqq.changePercent >= 0 ? "+" : "") + marketIndicators.qqq.changePercent.toFixed(2) + "%" : "N/A"}, VIX ${marketIndicators.vix?.price?.toFixed(1) ?? "N/A"}`,
  ];
  if (breakouts.length > 0) {
    dataLines.push(
      `Breakout signals: ${breakouts.map((t) => `${t.symbol} (score ${t.score.toFixed(0)}, ${t.changePercent != null ? (t.changePercent >= 0 ? "+" : "") + t.changePercent.toFixed(1) + "%" : "N/A"}, ${t.sectorName})`).join("; ")}`,
    );
  }
  if (highRsi.length > 0) {
    dataLines.push(
      `Overbought (RSI>72): ${highRsi.map((t) => `${t.symbol} RSI ${t.rsi?.toFixed(0)}`).join(", ")}`,
    );
  }
  if (vixHigh) {
    dataLines.push(`Elevated VIX (${marketIndicators.vix!.price!.toFixed(1)}) indicates heightened market volatility`);
  }
  dataLines.push(
    `Top movers: ${topGainers.map((t) => `${t.symbol} ${t.changePercent != null ? (t.changePercent >= 0 ? "+" : "") + t.changePercent.toFixed(1) + "%" : ""}`).join(", ")}`,
  );

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 400,
      system: `You are a momentum equity analyst generating proactive trade alerts. Given market data, return a JSON array of 1-4 alert objects. Each object must have exactly these fields:
- "level": one of "breakout", "anomaly", or "watch"
- "ticker": the primary ticker symbol string, or null if market-wide
- "headline": concise alert title (max 60 chars)
- "detail": 1 sentence explanation with specific numbers

Return ONLY a valid JSON array, no markdown, no commentary.`,
      messages: [
        {
          role: "user",
          content: `Analyze this market snapshot and generate alerts:\n${dataLines.join("\n")}`,
        },
      ],
    });

    const raw = message.content[0]?.type === "text" ? message.content[0].text.trim() : "[]";

    let parsed: Alert[];
    try {
      parsed = JSON.parse(raw) as Alert[];
      if (!Array.isArray(parsed)) parsed = [];
      // Sanitize and add IDs
      parsed = parsed.slice(0, 4).map((a, i) => ({
        id: `alert-${Date.now()}-${i}`,
        level: (["breakout", "anomaly", "watch"] as const).includes(a.level as "breakout" | "anomaly" | "watch")
          ? a.level
          : "watch",
        ticker: typeof a.ticker === "string" ? a.ticker : null,
        headline: String(a.headline ?? "").slice(0, 80),
        detail: String(a.detail ?? "").slice(0, 200),
      }));
    } catch {
      parsed = [];
    }

    return NextResponse.json({ alerts: parsed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Claude API error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
