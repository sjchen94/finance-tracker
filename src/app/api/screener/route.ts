import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Anthropic();

type ScreenerTicker = {
  symbol: string;
  score: number;
  changePercent: number | null;
  breakout: boolean;
  rsi: number | null;
  return1m: number | null;
  return3m: number | null;
  above50d: boolean | null;
  above200d: boolean | null;
  volumeSurge: number | null;
  macdSignal: string | null;
};

type ScreenerSector = {
  name: string;
  averageScore: number;
  tickers: ScreenerTicker[];
};

export type ScreenerRequest = {
  sectors: ScreenerSector[];
  marketIndicators: {
    spy: { price: number | null; changePercent: number | null } | null;
    qqq: { price: number | null; changePercent: number | null } | null;
    vix: { price: number | null; changePercent: number | null } | null;
  };
  query: string;
};

export type ScreenerMatch = {
  symbol: string;
  reason: string;
};

export type ScreenerResponse = {
  matches: ScreenerMatch[];
};

export async function POST(req: NextRequest) {
  let body: ScreenerRequest;
  try {
    body = (await req.json()) as ScreenerRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sectors, marketIndicators, query } = body;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  // Build a concise text representation of all tickers in the bundle
  const tickerLines = sectors
    .flatMap((s) =>
      s.tickers.map((t) => {
        const parts: string[] = [
          `${t.symbol} (${s.name})`,
          `score=${t.score.toFixed(0)}`,
          t.changePercent != null ? `chg=${t.changePercent >= 0 ? "+" : ""}${t.changePercent.toFixed(1)}%` : null,
          t.rsi != null ? `rsi=${t.rsi.toFixed(0)}` : null,
          t.return1m != null ? `ret1m=${t.return1m >= 0 ? "+" : ""}${t.return1m.toFixed(1)}%` : null,
          t.return3m != null ? `ret3m=${t.return3m >= 0 ? "+" : ""}${t.return3m.toFixed(1)}%` : null,
          t.breakout ? "breakout=true" : null,
          t.above50d != null ? `above50d=${t.above50d}` : null,
          t.above200d != null ? `above200d=${t.above200d}` : null,
          t.volumeSurge != null ? `volSurge=${t.volumeSurge.toFixed(1)}x` : null,
          t.macdSignal ? `macd=${t.macdSignal}` : null,
        ].filter((p): p is string => p !== null);
        return parts.join(" ");
      }),
    )
    .join("\n");

  const marketLine = [
    `SPY ${marketIndicators.spy?.changePercent != null ? (marketIndicators.spy.changePercent >= 0 ? "+" : "") + marketIndicators.spy.changePercent.toFixed(2) + "%" : "N/A"}`,
    `QQQ ${marketIndicators.qqq?.changePercent != null ? (marketIndicators.qqq.changePercent >= 0 ? "+" : "") + marketIndicators.qqq.changePercent.toFixed(2) + "%" : "N/A"}`,
    `VIX ${marketIndicators.vix?.price != null ? marketIndicators.vix.price.toFixed(1) : "N/A"}`,
  ].join(", ");

  const prompt = `Market context: ${marketLine}

Available tickers and their momentum metrics:
${tickerLines}

User screen query: "${query.trim()}"

Return a JSON object with a "matches" array. Each element must have:
- "symbol": the ticker symbol (string)
- "reason": one concise sentence explaining why this ticker matches the query

Only include tickers that genuinely match the query. If no tickers match, return {"matches":[]}.
Return ONLY valid JSON, no markdown, no commentary.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system:
        "You are a quantitative equity screener assistant. Given momentum metrics for a universe of tickers and a free-text screening query, identify tickers that match the criteria and explain why. Be precise and data-driven. Return only the requested JSON format.",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const raw =
      message.content[0]?.type === "text" ? message.content[0].text.trim() : '{"matches":[]}';

    let parsed: ScreenerResponse;
    try {
      parsed = JSON.parse(raw) as ScreenerResponse;
      if (!parsed.matches || !Array.isArray(parsed.matches)) {
        parsed = { matches: [] };
      }
      parsed.matches = parsed.matches
        .filter(
          (m): m is ScreenerMatch =>
            typeof m === "object" &&
            m !== null &&
            typeof m.symbol === "string" &&
            typeof m.reason === "string",
        )
        .map((m) => ({
          symbol: String(m.symbol).toUpperCase().trim(),
          reason: String(m.reason).slice(0, 200),
        }))
        .slice(0, 20);
    } catch {
      parsed = { matches: [] };
    }

    return NextResponse.json(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Claude API error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
